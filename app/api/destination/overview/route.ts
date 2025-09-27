import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { DestinationCacheService } from '@/lib/server/destination-cache'
import { requireAuthenticatedUser, UnauthorizedError } from '@/lib/server/auth'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Enhanced prompt engineering system
interface DestinationContext {
  type: 'city' | 'landmark' | 'nature' | 'cultural' | 'adventure' | 'historical' | 'beach' | 'mountain' | 'unknown'
  region?: string
  climate?: string
  bestSeason?: string
  keyFeatures?: string[]
  culturalNotes?: string[]
}

function getDestinationContext(destination: string, city?: string, category?: string): DestinationContext {
  const context: DestinationContext = { type: 'unknown' }
  
  // Determine destination type based on name and category
  const destLower = destination.toLowerCase()
  const cityLower = city?.toLowerCase() || ''
  const categoryLower = category?.toLowerCase() || ''
  
  // City detection
  if (destLower.includes('city') || destLower.includes('town') || cityLower) {
    context.type = 'city'
  }
  // Landmark detection
  else if (destLower.includes('tower') || destLower.includes('bridge') || destLower.includes('palace') || 
           destLower.includes('castle') || destLower.includes('monument') || destLower.includes('statue')) {
    context.type = 'landmark'
  }
  // Nature detection
  else if (destLower.includes('park') || destLower.includes('forest') || destLower.includes('lake') || 
           destLower.includes('river') || destLower.includes('garden') || destLower.includes('reserve')) {
    context.type = 'nature'
  }
  // Beach detection
  else if (destLower.includes('beach') || destLower.includes('coast') || destLower.includes('shore') || 
           destLower.includes('bay') || destLower.includes('island')) {
    context.type = 'beach'
  }
  // Mountain detection
  else if (destLower.includes('mountain') || destLower.includes('peak') || destLower.includes('hill') || 
           destLower.includes('summit') || destLower.includes('ridge')) {
    context.type = 'mountain'
  }
  // Cultural detection
  else if (destLower.includes('museum') || destLower.includes('temple') || destLower.includes('church') || 
           destLower.includes('mosque') || destLower.includes('cathedral') || destLower.includes('shrine')) {
    context.type = 'cultural'
  }
  // Historical detection
  else if (destLower.includes('ruins') || destLower.includes('ancient') || destLower.includes('historic') || 
           destLower.includes('archaeological') || destLower.includes('heritage')) {
    context.type = 'historical'
  }
  // Adventure detection
  else if (destLower.includes('adventure') || destLower.includes('extreme') || destLower.includes('sport') || 
           destLower.includes('climbing') || destLower.includes('hiking')) {
    context.type = 'adventure'
  }
  
  // Add category-based context
  if (categoryLower) {
    if (categoryLower.includes('cultural') || categoryLower.includes('museum') || categoryLower.includes('art')) {
      context.type = 'cultural'
    } else if (categoryLower.includes('nature') || categoryLower.includes('park') || categoryLower.includes('wildlife')) {
      context.type = 'nature'
    } else if (categoryLower.includes('beach') || categoryLower.includes('coastal')) {
      context.type = 'beach'
    } else if (categoryLower.includes('mountain') || categoryLower.includes('hiking') || categoryLower.includes('climbing')) {
      context.type = 'mountain'
    } else if (categoryLower.includes('historical') || categoryLower.includes('heritage')) {
      context.type = 'historical'
    }
  }
  
  // Add regional context
  if (cityLower.includes('europe') || cityLower.includes('italy') || cityLower.includes('france') || 
      cityLower.includes('spain') || cityLower.includes('germany') || cityLower.includes('uk')) {
    context.region = 'Europe'
  } else if (cityLower.includes('asia') || cityLower.includes('japan') || cityLower.includes('china') || 
             cityLower.includes('thailand') || cityLower.includes('india')) {
    context.region = 'Asia'
  } else if (cityLower.includes('america') || cityLower.includes('usa') || cityLower.includes('canada') || 
             cityLower.includes('mexico')) {
    context.region = 'Americas'
  }
  
  return context
}

function createEnhancedPrompt(destination: string, city?: string, category?: string, context?: DestinationContext): string {
  const basePrompt = `Write a compelling, informative overview of ${destination}${city ? ` in ${city}` : ''}${category ? ` (${category})` : ''}.`
  
  const contextSpecificGuidance = getContextSpecificGuidance(context)
  const structureGuidance = getStructureGuidance(context)
  
  return `${basePrompt}

${contextSpecificGuidance}

${structureGuidance}

Requirements:
- Write 3-4 engaging paragraphs (250-300 words total)
- Use an engaging, travel-guide tone that's warm and accessible
- Avoid generic descriptions - be specific and authentic
- Include practical information (best time to visit, key highlights, local culture)
- Mention what visitors can expect to see, do, or experience
- Include interesting facts or historical context if relevant
- Keep it informative but accessible for travelers

IMPORTANT: Structure your content to naturally flow into these sections:
1. First paragraph: General overview and introduction
2. Second paragraph: Key attractions, landmarks, or main highlights
3. Third paragraph: History, culture, or unique characteristics
4. Fourth paragraph: Best time to visit, practical tips, or seasonal information

Use natural transitions between topics. For example, if discussing attractions, naturally mention historical context. If covering culture, include information about the best times to experience it. This helps create a cohesive narrative that can be easily structured in the UI.

Format the response as clean, readable text without any markdown formatting or special characters.`
}

function getContextSpecificGuidance(context?: DestinationContext): string {
  if (!context) return ''
  
  switch (context.type) {
    case 'city':
      return `Focus on the city's unique character, local culture, and urban attractions. Highlight distinctive neighborhoods, local cuisine, and the city's personality.`
    case 'landmark':
      return `Emphasize the landmark's historical significance, architectural beauty, and cultural importance. Include practical visiting information and what makes it special.`
    case 'nature':
      return `Highlight the natural beauty, wildlife, and outdoor activities. Describe the landscape, seasonal changes, and conservation efforts.`
    case 'cultural':
      return `Focus on cultural significance, artistic value, and spiritual importance. Include information about ceremonies, traditions, and cultural practices.`
    case 'historical':
      return `Emphasize historical importance, archaeological significance, and what visitors can learn about the past. Include preservation efforts and historical context.`
    case 'beach':
      return `Highlight the coastal beauty, water activities, and beach amenities. Include information about weather, seasons, and marine life.`
    case 'mountain':
      return `Focus on scenic beauty, hiking opportunities, and mountain activities. Include information about difficulty levels, seasons, and safety considerations.`
    case 'adventure':
      return `Emphasize thrilling activities, skill requirements, and safety considerations. Highlight what makes this destination exciting for adventure seekers.`
    default:
      return `Focus on what makes this destination unique and worth visiting. Highlight distinctive features and visitor experiences.`
  }
}

function getStructureGuidance(context?: DestinationContext): string {
  if (!context) return ''
  
  switch (context.type) {
    case 'city':
      return `Structure: 1) City overview and character, 2) Key attractions and neighborhoods, 3) Local culture and cuisine, 4) Practical visiting tips`
    case 'landmark':
      return `Structure: 1) Historical significance and background, 2) Architectural features and beauty, 3) Visitor experience and highlights, 4) Practical visiting information`
    case 'nature':
      return `Structure: 1) Natural beauty and landscape, 2) Wildlife and biodiversity, 3) Outdoor activities and experiences, 4) Best times to visit and conservation`
    case 'cultural':
      return `Structure: 1) Cultural significance and history, 2) Artistic and spiritual importance, 3) Traditions and practices, 4) Visitor experience and etiquette`
    case 'historical':
      return `Structure: 1) Historical background and significance, 2) Archaeological importance, 3) What visitors can discover, 4) Preservation and educational value`
    case 'beach':
      return `Structure: 1) Coastal beauty and setting, 2) Water activities and amenities, 3) Marine life and natural features, 4) Best seasons and practical tips`
    case 'mountain':
      return `Structure: 1) Scenic beauty and landscape, 2) Hiking and outdoor activities, 3) Difficulty levels and safety, 4) Best seasons and preparation`
    case 'adventure':
      return `Structure: 1) Adventure opportunities and thrills, 2) Skill requirements and challenges, 3) Safety considerations and preparation, 4) Unique experiences and highlights`
    default:
      return `Structure: 1) Destination overview and uniqueness, 2) Key attractions and highlights, 3) Visitor experiences and activities, 4) Practical information and tips`
  }
}

function calculateContentQuality(content: string, context?: DestinationContext): number {
  let score = 0.5 // Base score
  
  // Word count scoring (prefer 250-300 words)
  const wordCount = content.split(' ').length
  if (wordCount >= 250 && wordCount <= 300) {
    score += 0.2
  } else if (wordCount >= 200 && wordCount <= 350) {
    score += 0.1
  }
  
  // Paragraph structure scoring
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0)
  if (paragraphs.length >= 3 && paragraphs.length <= 4) {
    score += 0.1
  }
  
  // Content richness scoring
  const hasPracticalInfo = /best time|visit|hours|open|closed|admission|ticket/i.test(content)
  const hasCulturalInfo = /culture|cultural|tradition|local|history|historical/i.test(content)
  const hasDescriptiveInfo = /beautiful|stunning|amazing|unique|special|famous/i.test(content)
  
  if (hasPracticalInfo) score += 0.1
  if (hasCulturalInfo) score += 0.1
  if (hasDescriptiveInfo) score += 0.1
  
  // Context-specific scoring
  if (context) {
    const contextKeywords = getContextKeywords(context.type)
    const hasContextKeywords = contextKeywords.some(keyword => 
      content.toLowerCase().includes(keyword.toLowerCase())
    )
    if (hasContextKeywords) score += 0.1
  }
  
  // Avoid generic content
  const genericPhrases = ['beautiful place', 'worth visiting', 'great destination', 'amazing experience']
  const hasGenericPhrases = genericPhrases.some(phrase => 
    content.toLowerCase().includes(phrase.toLowerCase())
  )
  if (!hasGenericPhrases) score += 0.1
  
  // Cap at 1.0
  return Math.min(score, 1.0)
}

function getContextKeywords(type: string): string[] {
  switch (type) {
    case 'city':
      return ['neighborhood', 'district', 'cuisine', 'local', 'urban', 'metropolitan']
    case 'landmark':
      return ['architecture', 'monument', 'tower', 'bridge', 'palace', 'castle']
    case 'nature':
      return ['wildlife', 'conservation', 'ecosystem', 'trail', 'hiking', 'scenic']
    case 'cultural':
      return ['ceremony', 'tradition', 'artistic', 'spiritual', 'religious', 'museum']
    case 'historical':
      return ['archaeological', 'ancient', 'ruins', 'heritage', 'preservation', 'excavation']
    case 'beach':
      return ['coastal', 'marine', 'tide', 'sand', 'water', 'swimming']
    case 'mountain':
      return ['summit', 'peak', 'altitude', 'hiking', 'climbing', 'scenic']
    case 'adventure':
      return ['thrilling', 'challenge', 'adventure', 'extreme', 'exciting', 'adrenaline']
    default:
      return ['unique', 'special', 'distinctive', 'characteristic', 'notable']
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const logContext: { destination: string; city?: string; category?: string } = {
    destination: '',
    city: undefined,
    category: undefined,
  }

  try {
    await requireAuthenticatedUser(request)

    const requestData = await request.json()
    const destination = requestData.destination ?? ''
    const city: string | undefined = requestData.city ?? undefined
    const category: string | undefined = requestData.category ?? undefined

    logContext.destination = destination
    logContext.city = city
    logContext.category = category

    if (!destination) {
      return NextResponse.json({ error: 'Destination name is required' }, { status: 400 })
    }

    // Check cache first
    const cached = await DestinationCacheService.getCachedOverview(destination, city, category)
    if (cached) {
      await DestinationCacheService.logApiCall(
        'destination/overview',
        { destination, city, category },
        Date.now() - startTime,
        true
      )
      return NextResponse.json({ overview: cached.overview, source: cached.source })
    }

    // Enhanced prompt engineering with destination-specific context
    const destinationContext = getDestinationContext(destination, city, category)
    const prompt = createEnhancedPrompt(destination, city, category, destinationContext)

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a knowledgeable travel writer who creates engaging, informative destination overviews. Write in a warm, accessible tone that helps travelers understand what makes each place special. Focus on authenticity, practical information, and creating a genuine connection with the destination.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 600,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    })

    const overview = completion.choices[0]?.message?.content || ''
    
    // Calculate content quality score
    const qualityScore = calculateContentQuality(overview, destinationContext)
    
    // Enhanced caching with quality metadata
    await DestinationCacheService.setCachedOverview(
      destination, 
      city, 
      category, 
      overview,
      {
        destinationType: destinationContext.type,
        region: destinationContext.region,
        qualityScore,
        wordCount: overview.split(' ').length,
        generatedAt: new Date().toISOString()
      }
    )

    // Enhanced logging with quality metrics
    const responseTime = Date.now() - startTime
    await DestinationCacheService.logApiCall(
      'destination/overview',
      { 
        destination,
        city,
        category,
        destinationType: destinationContext.type,
        region: destinationContext.region,
        qualityScore,
        wordCount: overview.split(' ').length,
        responseTimeMs: responseTime
      },
      responseTime,
      true
    )

    console.log(`Overview API: ${destination} (${destinationContext.type}) - Quality: ${qualityScore.toFixed(2)}, Words: ${overview.split(' ').length}, Time: ${responseTime}ms`)

    return NextResponse.json({ 
      overview, 
      source: 'api',
      metadata: {
        destinationType: destinationContext.type,
        qualityScore,
        wordCount: overview.split(' ').length
      }
    })

  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('Error generating destination overview:', error)

    // Log the error
    await DestinationCacheService.logApiCall(
      'destination/overview',
      { 
        destination: logContext.destination, 
        city: logContext.city, 
        category: logContext.category 
      },
      Date.now() - startTime,
      false,
      error instanceof Error ? error.message : 'Unknown error'
    )

    return NextResponse.json(
      { error: 'Failed to generate destination overview' },
      { status: 500 }
    )
  }
}
