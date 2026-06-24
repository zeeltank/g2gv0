export interface Employee {
  id: number | string;
  full_name: string;
  email: string;
  mobile: string;
  department_name: string;
  jobRole: string;
  designation: string;
  address: string;
  image: string;
  occupation: string;
  status: string;
  lastActivity: string;
  join_Date: string;
  profile_name: string;
  skills: any[]; // Array of skill objects
}
