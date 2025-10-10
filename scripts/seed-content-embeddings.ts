#!/usr/bin/env tsx
/**
 * Seed content_embeddings table with destination data
 * 
 * Usage: tsx scripts/seed-content-embeddings.ts
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !openaiKey) {
  console.error('❌ Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiKey });

interface DestinationContent {
  destination_name: string;
  summary: string | null;
  destination_coordinates: string | null;
  destination_category: string | null;
  general_information: string | null;
  metadata: any;
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

async function seedContentEmbeddings() {
  console.log('🌱 Starting content embeddings seed...\n');

  // 1. Fetch destination content
  console.log('📥 Fetching destination content...');
  const { data: destinations, error: fetchError } = await supabase
    .from('destination_modal_content')
    .select('destination_name, summary, destination_coordinates, destination_category, general_information, metadata')
    .not('summary', 'is', null)
    .order('view_count', { ascending: false })
    .limit(10);

  if (fetchError) {
    console.error('❌ Error fetching destinations:', fetchError);
    process.exit(1);
  }

  if (!destinations || destinations.length === 0) {
    console.log('⚠️  No destinations found with summaries');
    process.exit(0);
  }

  console.log(`✅ Found ${destinations.length} destinations with content\n`);

  // 2. Generate embeddings and insert
  let successCount = 0;
  let errorCount = 0;

  for (const dest of destinations as DestinationContent[]) {
    try {
      console.log(`🔄 Processing: ${dest.destination_name}...`);

      // Create text to embed (combine title + summary + general info)
      const textToEmbed = [
        dest.destination_name,
        dest.summary || '',
        dest.general_information || '',
      ]
        .filter(Boolean)
        .join('\n\n');

      // Generate embedding
      const embedding = await generateEmbedding(textToEmbed);
      
      // Prepare snippet (first 500 chars of summary or general info)
      const snippet = (dest.summary || dest.general_information || '').slice(0, 500);

      // Parse coordinates if available
      let coords = null;
      if (dest.destination_coordinates) {
        // Format: "(lng,lat)" - extract to object
        const match = dest.destination_coordinates.match(/\(([^,]+),([^)]+)\)/);
        if (match) {
          coords = {
            lng: parseFloat(match[1]),
            lat: parseFloat(match[2]),
          };
        }
      }

      // Insert into content_embeddings
      const { error: insertError } = await supabase
        .from('content_embeddings')
        .insert({
          title: dest.destination_name,
          snippet,
          url: `/destinations/${encodeURIComponent(dest.destination_name)}`,
          tags: [dest.destination_category || 'destination'],
          metadata: {
            ...dest.metadata,
            category: dest.destination_category,
            coordinates: coords,
            source: 'destination_modal_content',
          },
          embedding: embedding as any, // Cast to any to satisfy type checking
        });

      if (insertError) {
        console.error(`  ❌ Error inserting ${dest.destination_name}:`, insertError.message);
        errorCount++;
      } else {
        console.log(`  ✅ Embedded: ${dest.destination_name}`);
        successCount++;
      }

      // Rate limiting - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`  ❌ Error processing ${dest.destination_name}:`, error);
      errorCount++;
    }
  }

  // 3. Summary
  console.log('\n📊 Seed Summary:');
  console.log(`   ✅ Successfully embedded: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total processed: ${successCount + errorCount}`);

  // 4. Test the match function
  console.log('\n🧪 Testing match_content_embeddings function...');
  try {
    const testEmbedding = await generateEmbedding('beautiful medieval city in Tuscany');
    
    const { data: matches, error: matchError } = await supabase.rpc('match_content_embeddings', {
      query_embedding: testEmbedding as any,
      match_threshold: 0.5,
      match_count: 3,
    });

    if (matchError) {
      console.error('❌ Error testing match function:', matchError);
    } else {
      console.log(`✅ Match function works! Found ${matches?.length || 0} similar items:`);
      matches?.forEach((match: any, i: number) => {
        console.log(`   ${i + 1}. ${match.title} (similarity: ${match.similarity.toFixed(3)})`);
      });
    }
  } catch (error) {
    console.error('❌ Error testing match function:', error);
  }

  console.log('\n✨ Seed complete!\n');
}

// Run the seed
seedContentEmbeddings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });

