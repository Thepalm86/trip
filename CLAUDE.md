# Trip3 - Intelligent Itinerary Builder

## Project Overview

Trip3 is a modern travel itinerary planning application built with Next.js 15 and React 19. It features an interactive map canvas integrated with a day-by-day timeline planner, allowing users to build comprehensive travel itineraries through an intuitive drag-and-drop interface.

## Architecture

### Core Framework
- **Frontend**: Next.js 15 with App Router and TypeScript
- **React**: Version 19 with modern hooks and concurrent features
- **Styling**: Tailwind CSS with custom glass morphism design system
- **State Management**: Zustand for global trip state
- **Data Layer**: Supabase for authentication and trip persistence

### Key Dependencies
- **Maps**: Mapbox GL JS with react-map-gl wrapper
- **UI**: Radix UI primitives with custom styling
- **Forms**: React Hook Form with Zod validation
- **Animation**: Framer Motion for smooth transitions
- **Database**: Supabase client with TypeScript types
- **Development**: ESLint, Prettier, TypeScript with strict config

## Features

### Core Functionality
1. **Interactive Map** (40% viewport) - Mapbox-powered with custom dark theme
2. **Timeline Planner** (60% viewport) - Day-by-day itinerary with drag-and-drop
3. **Destination Management** - Add, edit, and organize destinations
4. **Trip Persistence** - Save and load trips via Supabase
5. **User Authentication** - Secure login and trip ownership

### User Interface
- Glass morphism design with navy gradients and mint accents
- Responsive layout optimized for desktop trip planning
- Smooth animations with sub-100ms interaction response
- Premium typography with Inter and Playfair Display fonts

## Development Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format with Prettier
npm run format:check # Check Prettier formatting
npm run typecheck    # Run TypeScript checks
```

## Key Components

### Map System (`components/map/`)
- **InteractiveMap.tsx** - Main Mapbox integration with markers
- **MapIntegration.tsx** - Coordinates map and timeline interactions
- **RouteManager.tsx** - Handles route visualization between destinations
- **MarkerManager.tsx** - Manages destination markers and popups

### Timeline System (`components/left-panel/`)
- **ItineraryTab.tsx** - Main timeline interface
- **DayCard.tsx** - Individual day containers with destinations
- **AddDestinationModal.tsx** - Modal for adding new destinations
- **DateSelector.tsx** - Date range picker for trip planning

### Data Layer (`lib/`)
- **trip-store.ts** - Zustand store for client-side state
- **supabase-trip-store.ts** - Supabase integration for persistence
- **trip-api.ts** - API functions for CRUD operations

## Database Schema

### Core Tables
- **trips** - Trip metadata (name, dates, user ownership)
- **destinations** - Destination data with coordinates and details
- **trip_days** - Daily itinerary structure linking trips and destinations

### Key Relationships
- Trips have many days
- Days have many destinations through join table
- Users own trips through authentication

## Environment Setup

### Required Variables
```bash
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### Local Development
1. Install dependencies: `npm install`
2. Set up environment variables in `.env.local`
3. Run development server: `npm run dev`
4. Access at `http://localhost:3000`

## Code Patterns

### State Management
- Use Zustand for global trip state
- Local React state for component-specific data
- React Query for server state when needed

### Component Structure
- Functional components with TypeScript
- Custom hooks for complex logic
- Separation of concerns between UI and business logic

### Styling Approach
- Tailwind CSS utility classes
- Component variants with class-variance-authority
- CSS modules for complex animations

## Testing Strategy

### Development Testing
- Manual testing during development
- TypeScript for compile-time validation
- ESLint for code quality enforcement

### Future Testing Plans
- Unit tests with Jest and React Testing Library
- Integration tests for map-timeline interactions
- E2E tests with Playwright for user workflows

## Performance Considerations

### Optimization Strategies
- Next.js automatic code splitting
- React 19 concurrent features for smooth interactions
- Mapbox GL JS WebGL rendering for map performance
- Zustand for minimal re-renders

### Bundle Management
- Dynamic imports for heavy components
- Image optimization with Next.js
- CSS-in-JS for component-scoped styles

## Security

### Authentication
- Supabase Auth for user management
- Row Level Security (RLS) for data access
- JWT tokens for API authentication

### Data Protection
- Environment variables for sensitive data
- HTTPS enforcement in production
- Input validation with Zod schemas

## Deployment

### Production Build
1. Run `npm run build` to create production bundle
2. Test with `npm run start` locally
3. Deploy to preferred hosting platform (Vercel recommended)

### Environment Configuration
- Set production environment variables
- Configure domain and SSL certificates
- Enable analytics and monitoring

## Contributing Guidelines

### Code Style
- Follow ESLint and Prettier configurations
- Use TypeScript for all new code
- Write descriptive commit messages
- Maintain consistent component patterns

### Development Workflow
1. Create feature branches from main
2. Run type checks and linting before commits
3. Test changes manually with development server
4. Submit pull requests with clear descriptions

## Future Roadmap

### Planned Features
- AI-powered destination recommendations
- Route optimization algorithms
- Budget tracking and cost estimates
- Collaborative trip planning
- Mobile responsive design
- Offline functionality

### Technical Improvements
- Implement comprehensive testing suite
- Add performance monitoring
- Enhance error handling and logging
- Implement caching strategies

## Troubleshooting

### Common Issues
- **Map not loading**: Check Mapbox token configuration
- **Build failures**: Run `npm run typecheck` to identify TypeScript errors
- **Style issues**: Verify Tailwind configuration and imports
- **Database errors**: Check Supabase connection and RLS policies

### Development Tips
- Use browser dev tools for debugging map interactions
- Check console for React warnings and errors
- Verify environment variables in development
- Test with different screen sizes for responsiveness