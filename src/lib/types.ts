export interface Family {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
  children?: Child[]
  memberships?: Membership[]
}

export interface Child {
  id: string
  family_id: string
  name: string
  birth_date: string | null
}

export interface MembershipType {
  id: string
  name: string
  sessions: number | null
  price: number
  validity_days: number
}

export interface Membership {
  id: string
  family_id: string
  membership_type_id: string
  sessions_remaining: number | null
  expires_at: string
  created_at: string
  membership_types?: MembershipType
}

export interface Visit {
  id: string
  family_id: string
  membership_id: string | null
  checked_in_at: string
  families?: Family
}
