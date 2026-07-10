export type TabId = 'personal' | 'address' | 'reporting' | 'attendance' | 'bank'

export interface Profile {
  id: string
  fullName: string
  mobileNumber: string
  email: string
  department: string
  dob: string
  jobRole: string
  gender: string
  joinYear: string
  address1: string
  address2: string
  city: string
  state: string
  pincode: string
  reporting: Array<{
    supervisorType: string
    employeeName: string
    reportingMethod: string
  }>
  attendance: Array<{
    day: string
    login: string
    logout: string
  }>
  bankDetails: {
    bankName: string
    branchName: string
    accountNumber: string
    ifscCode: string
    amount: string
    transferType: string
  }
}

export interface ProfileProps {
  user?: {
    id: string
    name: string
    email: string
    role: string
  }
}

export const mockProfile = {
  id: '1',
  fullName: 'Alex Morgan',
  mobileNumber: '+1 234 567 8900',
  email: 'alex.morgan@company.com',
  department: 'Engineering',
  dob: '1990-05-15',
  jobRole: 'Senior Software Engineer',
  gender: 'Male',
  joinYear: '2020-01-10',
  address1: '123 Main Street',
  address2: 'Apt 4B',
  city: 'San Francisco',
  state: 'California',
  pincode: '94102',
  reporting: [
    { supervisorType: 'Direct', employeeName: 'Sarah Wilson', reportingMethod: 'Formal' },
    { supervisorType: 'Function', employeeName: 'James Chen', reportingMethod: 'Informal' },
  ],
  attendance: [
    { day: 'Monday', login: '09:00 AM', logout: '06:00 PM' },
    { day: 'Tuesday', login: '09:00 AM', logout: '06:00 PM' },
    { day: 'Wednesday', login: '09:00 AM', logout: '06:00 PM' },
    { day: 'Thursday', login: '09:00 AM', logout: '06:00 PM' },
    { day: 'Friday', login: '09:30 AM', logout: '06:30 PM' },
    { day: 'Saturday', login: '09:00 AM', logout: '01:00 PM' },
  ],
  bankDetails: {
    bankName: 'HDFC Bank',
    branchName: 'Main Branch',
    accountNumber: '1234567890',
    ifscCode: 'HDFC0001234',
    amount: '5,000.00',
    transferType: 'NEFT',
  },
}
