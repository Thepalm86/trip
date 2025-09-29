export interface AssessmentDestination {
  name: string
  country?: string
}

export interface NewUserAssessmentResult {
  destinations: AssessmentDestination[]
  durationDays: number
  datesKnown: boolean
  startDate?: string
  endDate?: string
}
