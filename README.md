# Trip3 - Intelligent Itinerary Builder

A simplified, focused itinerary-building travel application built with Next.js 15, featuring interactive maps and day-by-day timeline planning.

## 🚀 Features

- **Interactive Map Canvas** (40% width) - Mapbox-powered map with clickable destination markers
- **Timeline Planner** (60% width) - Day-by-day itinerary builder with drag-and-drop functionality
- **Real-time Integration** - Click map markers to add destinations to specific days
- **Glass Morphism Design** - Premium dark theme with Traveal2.0's design system
- **Drag & Drop** - Reorder destinations within and between days
- **Responsive Layout** - Optimized for desktop trip planning

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router, TypeScript, React 19
- **Styling**: Tailwind CSS with glass morphism design system
- **Maps**: Mapbox GL JS with custom dark theme
- **State Management**: Zustand store for trip data
- **UI Components**: Custom components with premium animations
- **Fonts**: Inter (body) + Playfair Display (headings)

## 🗺️ Layout Structure

```
┌─────────────────────────────────┬─────────────────────────┐
│                                 │                         │
│        Left Panel               │     Interactive Map     │
│                                 │        Canvas           │
│    Timeline Planner             │        (40% width)      │
│  Day-by-Day Scheduling          │                         │
│      (60% width)                │                         │
│                                 │                         │
│                                 │                         │
└─────────────────────────────────┴─────────────────────────┘
```

## 🎯 Key Interactions

1. **Map to Timeline**: Click destination markers on map → Select day → Add to timeline
2. **Drag & Drop**: Drag destinations between days or reorder within days
3. **Quick Add**: Use suggestion buttons for rapid itinerary building
4. **Day Management**: Add new days as needed for longer trips

## 🎨 Design Philosophy

Following Traveal2.0's premium design system:
- **Glass Morphism**: Translucent panels with sophisticated blur effects
- **Dark Theme**: Navy gradient backgrounds with mint green accents
- **Smooth Animations**: Purposeful transitions and hover effects
- **Typography**: Elegant font hierarchy for readability

## 🚀 Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   - Copy `.env.local` from Traveal2.0 (includes Mapbox token and other credentials)

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   - Navigate to `http://localhost:3000` (or the assigned port)

## 🗄️ Project Structure

```
trip3/
├── app/                    # Next.js App Router
│   ├── globals.css        # Global styles with glass morphism
│   ├── layout.tsx         # Root layout with fonts
│   └── page.tsx          # Main page with 60/40 layout
├── components/
│   ├── map/
│   │   └── InteractiveMap.tsx    # Mapbox integration
│   └── timeline/
│       ├── TimelinePlanner.tsx   # Main timeline component
│       ├── DroppableDay.tsx      # Drag-and-drop day container
│       └── DraggableDestination.tsx  # Draggable destination items
├── lib/
│   ├── store/
│   │   └── trip-store.ts         # Zustand state management
│   └── utils.ts                  # Utility functions
├── types/
│   └── index.ts                  # TypeScript definitions
└── README.md
```

## 🎯 Future Enhancements

The current implementation provides a solid foundation for:
- AI-powered destination recommendations
- Route optimization algorithms
- Budget tracking and management
- Collaborative planning features
- Mobile responsiveness
- Real-time data integration (weather, pricing, etc.)

## 📝 Development Notes

- Built using Traveal2.0's established patterns and credentials
- Focused on core map-timeline interaction for MVP
- Clean, maintainable code architecture for easy expansion
- Premium UX with sub-100ms interaction response times

---

**Status**: ✅ Core features implemented and functional  
**Development Server**: Running on port 3002  
**Last Updated**: September 2025