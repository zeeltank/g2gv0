export interface ProfileSkill {
  id: string
  name: string
}

export interface ProfileTimelineEvent {
  id: string
  title: string
  description: string
  date: string
  icon: 'user' | 'target' | 'star' | 'dollar' | 'briefcase'
}

export interface ProfileTeamMember {
  id: string
  name: string
  role: string
  status: 'Active' | 'Inactive'
  avatar: string
}

export interface ProfileAttachment {
  id: string
  name: string
  size: string
  type: 'pdf' | 'doc' | 'image'
}

export interface TalentProfileData {
  id: string
  name: string
  avatarInitials: string
  status: 'Active Employee' | 'Candidate' | 'Alumni'
  role: string
  department: string
  employeeId: string
  joinedDate: string
  location: string
  
  // Header Key Info
  businessUnit: string
  grade: string
  reportsTo: string
  employeeType: string
  workEmail: string

  // About Section
  dateOfBirth: string
  gender: string
  phone: string
  personalEmail: string

  // Sidebar Status
  employmentStatus: string
  probationStatus: string
  nextReview: string

  // Sidebar Key Info
  aadhaarNo: string
  pan: string
  pfNumber: string
  bloodGroup: string
  nationality: string
  maritalStatus: string

  // Current Position Details
  dateInCurrentRole: string
  totalExperience: string

  skills: ProfileSkill[]
  timeline: ProfileTimelineEvent[]
  teamMembers: ProfileTeamMember[]
  tags: string[]
  attachments: ProfileAttachment[]
}

export const mockProfileData: TalentProfileData = {
  id: 'EMP12345',
  name: 'Priya Sharma',
  avatarInitials: 'PS',
  status: 'Active Employee',
  role: 'Senior Product Manager',
  department: 'Product Management',
  employeeId: 'EMP12345',
  joinedDate: '15 Jan 2023',
  location: 'Pune, India',
  
  businessUnit: 'Product',
  grade: 'G6',
  reportsTo: 'Rahul Verma',
  employeeType: 'Full Time',
  workEmail: 'priya.sharma@acme.com',

  dateOfBirth: '12 Aug 1992',
  gender: 'Female',
  phone: '+91 98765 43210',
  personalEmail: 'priya.sharma@gmail.com',

  employmentStatus: 'Confirmed',
  probationStatus: 'Completed',
  nextReview: 'Apr 2025',

  aadhaarNo: 'XXXX XXXX 4321',
  pan: 'ABCDE1234F',
  pfNumber: 'PY/12345/67890',
  bloodGroup: 'O+',
  nationality: 'Indian',
  maritalStatus: 'Married',

  dateInCurrentRole: '01 Mar 2024',
  totalExperience: '9 Years 3 Months',

  skills: [
    { id: 's1', name: 'Product Strategy' },
    { id: 's2', name: 'Roadmapping' },
    { id: 's3', name: 'Market Research' },
    { id: 's4', name: 'Agile' },
    { id: 's5', name: 'Stakeholder Management' },
    { id: 's6', name: 'Data Analysis' },
  ],

  timeline: [
    { id: 't1', title: 'Joined Organization', description: 'Joined as Product Manager', date: '15 Jan 2023', icon: 'user' },
    { id: 't2', title: 'Goal Plan 2024', description: 'Goals set for FY 2024', date: '05 Apr 2024', icon: 'target' },
    { id: 't3', title: 'Performance Review', description: 'Completed FY 2023 Performance Review', date: '30 Apr 2024', icon: 'star' },
    { id: 't4', title: 'Salary Revision', description: 'Annual Revision effective 01 May 2024', date: '01 May 2024', icon: 'dollar' },
    { id: 't5', title: 'Internal Application', description: 'Applied for Senior Product Manager role', date: '10 Jan 2025', icon: 'briefcase' },
  ],

  teamMembers: [
    { id: 'tm1', name: 'Amit Singh', role: 'Product Analyst', status: 'Active', avatar: 'AS' },
    { id: 'tm2', name: 'Neha Reddy', role: 'Associate Product Manager', status: 'Active', avatar: 'NR' },
  ],

  tags: ['High Potential', 'Core Talent', 'Certified Scrum Product Owner'],

  attachments: [
    { id: 'a1', name: 'Resume.pdf', size: '450 KB', type: 'pdf' },
    { id: 'a2', name: 'Offer Letter.pdf', size: '320 KB', type: 'pdf' },
    { id: 'a3', name: 'Aadhaar Card.pdf', size: '512 KB', type: 'pdf' },
  ]
}
