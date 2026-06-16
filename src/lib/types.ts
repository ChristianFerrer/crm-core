export interface Family {
  id: string
  name: string
  notes: string | null
  created_at: string
}

export interface Member {
  id: string
  name: string
  phone: string | null
  email: string | null
  birth_date: string | null
  family_id: string | null
  notes: string | null
  qr_code: string
  created_at: string
  families?: Family
  memberships?: Membership[]
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
  member_id: string
  membership_type_id: string
  sessions_remaining: number | null
  expires_at: string
  created_at: string
  membership_types?: MembershipType
}

export interface Visit {
  id: string
  member_id: string
  membership_id: string | null
  checked_in_at: string
  members?: Member
}
