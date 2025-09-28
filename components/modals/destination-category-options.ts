export interface DestinationCategoryOption {
  value: string
  label: string
}

export const destinationCategoryOptions: DestinationCategoryOption[] = [
  { value: 'city', label: 'City' },
  { value: 'attraction', label: 'Attraction' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'activity', label: 'Activity' },
  { value: 'other', label: 'Other' },
]

export const predefinedDestinationCategories = destinationCategoryOptions
  .map((option) => option.value)
  .filter((value) => value !== 'other')
