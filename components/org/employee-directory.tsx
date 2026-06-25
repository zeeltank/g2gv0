'use client'

import * as React from 'react'
import { 
  Plus, Download, Upload, MoreHorizontal, 
  User, Briefcase, Shield, CheckCircle2, 
  Mail, Phone, Building, Calendar, MapPin, BadgeCheck
} from 'lucide-react'
import { EnterpriseDataTable, type Column } from '@/components/data/enterprise-data-table'
import { FilterBar, type Filter } from '@/components/data/filter-bar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusBadge } from '@/components/ui/status-badge'
import { PersonalInfoTab } from '@/components/org/edit-employee/personal-info-tab'
import { UploadDocTab } from '@/components/org/edit-employee/upload-doc-tab'
import { JobroleSkillTab } from '@/components/org/edit-employee/jobrole-skill-tab'
import { JobroleTasksTab } from '@/components/org/edit-employee/jobrole-tasks-tab'
import { LorTab } from '@/components/org/edit-employee/lor-tab'
import { CompetencyRatingTab } from '@/components/org/edit-employee/competency-rating-tab'
import { ExpectedCompetencyTab } from '@/components/org/edit-employee/expected-competency-tab'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { RadioGroup, Radio } from '@/components/ui/radio-group'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import type { Employee } from '@/types/employee'
import { cn } from '@/lib/utils'

// Mock Data
const defaultMockEmployees: Employee[] = [
  {
    id: 1,
    full_name: 'John Doe',
    email: 'john.doe@example.com',
    mobile: '+1 (555) 123-4567',
    department_name: 'Engineering',
    jobRole: 'Senior Developer',
    designation: 'Senior Developer',
    address: 'New York',
    image: '',
    occupation: 'Engineering',
    status: 'Active',
    lastActivity: 'Unknown',
    join_Date: '2023-01-15',
    profile_name: 'Admin',
    skills: []
  },
  {
    id: 2,
    full_name: 'Jane Smith',
    email: 'jane.smith@example.com',
    mobile: '+1 (555) 987-6543',
    department_name: 'Human Resources',
    jobRole: 'HR Manager',
    designation: 'HR Manager',
    address: 'San Francisco',
    image: '',
    occupation: 'HR',
    status: 'Active',
    lastActivity: 'Unknown',
    join_Date: '2022-11-01',
    profile_name: 'HR Admin',
    skills: []
  }
]

export function EmployeeDirectory() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [departmentFilter, setDepartmentFilter] = React.useState('')
  const [jobRoleFilter, setJobRoleFilter] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  
  // Sheet States
  const [isAddSheetOpen, setIsAddSheetOpen] = React.useState(false)
  const [activeEmployee, setActiveEmployee] = React.useState<Employee | null>(null)
  const [addStep, setAddStep] = React.useState(1)
  const [activeTopTab, setActiveTopTab] = React.useState('personal-info')

  const topTabs = [
    { id: 'personal-info', label: 'Personal Information' },
    { id: 'upload-docs', label: 'Upload Document' },
    { id: 'jobrole-skill', label: 'Jobrole Skill' },
    { id: 'jobrole-tasks', label: 'Jobrole Tasks' },
    { id: 'responsibility', label: 'Level of Responsibility' },
    { id: 'skill-rating', label: 'Competency Rating' },
    { id: 'expected-competency', label: 'Expected Competency' },
  ]

  // Configure Data Table Columns
  const columns: Column<Employee>[] = [
    {
      id: 'full_name',
      header: 'Employee',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          {row.image ? (
            <img src={row.image} alt={row.full_name} className="size-10 rounded-full object-cover border border-border" />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
              <User className="size-5" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{row.full_name}</span>
            <span className="text-xs text-muted-foreground">{row.email}</span>
          </div>
        </div>
      )
    },
    {
      id: 'department_name',
      header: 'Department',
      render: (_, row) => (
        <span className="text-sm font-medium">{row.department_name}</span>
      )
    },
    {
      id: 'jobRole',
      header: 'Job Role',
      render: (_, row) => (
        <span className="text-sm text-muted-foreground font-medium">{row.jobRole}</span>
      )
    },
    {
      id: 'status',
      header: 'Status',
      render: (val) => {
        const status = val as string;
        let variant: any = 'default';
        if (status.toLowerCase() === 'active') variant = 'active';
        if (status.toLowerCase() === 'inactive') variant = 'inactive';
        return <StatusBadge status={status} variant={variant} className="capitalize" />
      }
    },
    {
      id: 'id',
      header: 'Action',
      width: '16',
      render: (_, row) => (
        <div className="relative flex justify-start" onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 right-0 mt-1 absolute">
              <DropdownMenuItem onClick={() => setActiveEmployee(row)} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" /> View Profile
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-destructive focus-visible:bg-destructive/10">
                <Shield className="mr-2 h-4 w-4" /> Suspend Access
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  ]

  // Setup Filters
  const filters: Filter[] = [
    {
      id: 'search',
      label: 'Search Employee',
      type: 'search',
      value: searchQuery,
      onChange: (val) => setSearchQuery(val as string)
    },
    {
      id: 'department',
      label: 'Department',
      type: 'select',
      value: departmentFilter,
      onChange: (val) => setDepartmentFilter(val as string),
      options: [
        { id: '1', label: 'Engineering', value: 'Engineering' },
        { id: '2', label: 'Human Resources', value: 'Human Resources' },
        { id: '3', label: 'Marketing', value: 'Marketing' },
      ]
    },
    {
      id: 'jobrole',
      label: 'Job Role',
      type: 'select',
      value: jobRoleFilter,
      onChange: (val) => setJobRoleFilter(val as string),
      options: [
        { id: '1', label: 'Senior Developer', value: 'Senior Developer' },
        { id: '2', label: 'HR Manager', value: 'HR Manager' },
        { id: '3', label: 'Content Strategist', value: 'Content Strategist' },
      ]
    },
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      value: statusFilter,
      onChange: (val) => setStatusFilter(val as string),
      options: [
        { id: 'active', label: 'Active', value: 'active' },
        { id: 'inactive', label: 'Inactive', value: 'inactive' },
      ]
    }
  ]

  // Real Data Fetching Hook
  const [employeesData, setEmployeesData] = React.useState<Employee[]>(defaultMockEmployees)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let isMounted = true;
    const fetchEmployees = async () => {
      try {
        const userDataStr = localStorage.getItem('userData');
        if (!userDataStr) {
          setEmployeesData(defaultMockEmployees);
          setLoading(false);
          return;
        }

        const sessionData = JSON.parse(userDataStr);
        const { APP_URL, token, sub_institute_id, org_type, user_id, user_profile_name, syear } = sessionData;
        
        const apiUrl = `${APP_URL}/user/add_user?type=API&token=${token}&sub_institute_id=${sub_institute_id || 1}&org_type=${encodeURIComponent(org_type || 'Financial Services')}&user_id=${user_id}&user_profile_name=${encodeURIComponent(user_profile_name || 'Admin')}&syear=${syear || '2025'}`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (!isMounted) return;

        const raw = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : data ? [data] : [];
        const transformed = raw.map((item: any) => ({
          id: item.id || 0,
          full_name: item.full_name || 'N/A',
          email: item.email || 'N/A',
          mobile: item.mobile || 'N/A',
          department_name: item.department_name || 'N/A',
          jobRole: item.jobrole || 'N/A',
          designation: item.designation || 'N/A',
          address: item.address || 'N/A',
          image: item.image?.trim() ? item.image : '',
          occupation: item.occupation || 'N/A',
          status: item.status || 'Active',
          lastActivity: item.last_activity || 'Unknown',
          join_Date: item.join_date || 'Unknown',
          profile_name: item.profile_name || 'Unknown',
          skills: item.skills || [],
        }));
        
        setEmployeesData(transformed);
      } catch (err) {
        console.error('Failed to fetch employees via API:', err);
        if (isMounted) setEmployeesData(defaultMockEmployees);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    
    fetchEmployees();
    return () => { isMounted = false; }
  }, []);

  const handleResetFilters = () => {
    setSearchQuery('')
    setDepartmentFilter('')
    setJobRoleFilter('')
    setStatusFilter('')
  }

  const filteredData = React.useMemo(() => {
    return employeesData.filter(emp => {
      const matchSearch = emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || emp.email.toLowerCase().includes(searchQuery.toLowerCase())
      const matchDept = departmentFilter ? emp.department_name === departmentFilter : true
      const matchRole = jobRoleFilter ? emp.jobRole === jobRoleFilter : true
      const matchStatus = statusFilter ? emp.status.toLowerCase() === statusFilter.toLowerCase() : true
      return matchSearch && matchDept && matchRole && matchStatus
    })
  }, [searchQuery, departmentFilter, jobRoleFilter, statusFilter, employeesData])

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      {/* Premium Actions Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/50 backdrop-blur-xl border border-border/50 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <User className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Total Employees</h2>
            <p className="text-xs text-muted-foreground">
              {loading ? 'Loading...' : `${filteredData.length} total members`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hidden sm:flex cursor-pointer">
            <Upload className="w-4 h-4 mr-2" /> Import
          </Button>
          <Button variant="ghost" size="sm" className="hidden sm:flex cursor-pointer">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <div className="w-px h-6 bg-border mx-2 hidden sm:block" />
          <Button size="sm" onClick={() => { setAddStep(1); setIsAddSheetOpen(true); }} className="rounded-md px-5 shadow-sm cursor-pointer">
            <Plus className="w-4 h-4 mr-2" /> Add Employee
          </Button>
        </div>
      </div>

      <Card className="border-border/50 shadow-xs rounded-2xl bg-card/50 backdrop-blur-sm">
        <div className="p-4 border-b border-border/40 bg-surface-muted/30">
          <FilterBar filters={filters} onReset={handleResetFilters} />
        </div>
        <CardContent className="p-0">
          <EnterpriseDataTable
            columns={columns}
            data={filteredData}
            isLoading={loading}
            selectable
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
            onRowClick={(row) => setActiveEmployee(row)}
            className="border-0 rounded-none overflow-visible [&_th]:bg-transparent [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider [&_th]:font-semibold [&_td]:py-4"
          />
        </CardContent>
      </Card>

      {/* --- ADD EMPLOYEE SHEET (Premium Stepper Workflow) --- */}
      <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
        <SheetContent className="sm:max-w-xl p-0 overflow-hidden flex flex-col bg-card/95 backdrop-blur-2xl border-l-border/50 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none" />
          
          <div className="px-6 py-6 border-b border-border/40 relative z-10 bg-surface/50">
            <SheetTitle className="text-xl">Onboard New Employee</SheetTitle>
            <SheetDescription className="mt-1">
              Step {addStep} of 5: {
                addStep === 1 ? 'Personal Details' : 
                addStep === 2 ? 'Employment Structure' : 
                addStep === 3 ? 'Address Information' : 
                addStep === 4 ? 'Reporting & Deposit' : 
                'Attendance Setup'
              }
            </SheetDescription>
            
            {/* Stepper Progress */}
            <div className="flex items-center gap-2 mt-6">
              {[1, 2, 3, 4, 5].map((step) => (
                <React.Fragment key={step}>
                  <div className={cn(
                    "flex items-center justify-center size-8 rounded-full text-xs font-bold transition-all duration-300",
                    addStep === step ? "bg-primary text-primary-foreground shadow-md scale-110" : 
                    addStep > step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {addStep > step ? <CheckCircle2 className="size-4" /> : step}
                  </div>
                  {step < 5 && (
                    <div className={cn(
                      "flex-1 h-1 rounded-full transition-all duration-300",
                      addStep > step ? "bg-primary/30" : "bg-muted"
                    )} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto px-6 py-8 relative z-10 g2g-scrollbar">
            {addStep === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 text-primary mb-2">
                  <User className="size-5" />
                  <h3 className="font-semibold text-lg">Personal Identity</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Suffix</Label>
                    <Select options={[{label: 'Mr.', value: 'Mr.'}, {label: 'Ms.', value: 'Ms.'}, {label: 'Dr.', value: 'Dr.'}]} placeholder="Mr. / Ms. / Dr." />
                  </div>
                  <div className="space-y-2">
                    <Label required className="text-xs uppercase text-muted-foreground">First Name</Label>
                    <Input placeholder="First Name" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Middle Name</Label>
                    <Input placeholder="Middle Name" />
                  </div>
                  <div className="space-y-2">
                    <Label required className="text-xs uppercase text-muted-foreground">Last Name</Label>
                    <Input placeholder="Last Name" />
                  </div>
                  <div className="space-y-2">
                    <Label required className="text-xs uppercase text-muted-foreground">Email</Label>
                    <Input type="email" placeholder="example@domain.com" />
                  </div>
                  <div className="space-y-2">
                    <Label required className="text-xs uppercase text-muted-foreground">Password</Label>
                    <Input type="password" placeholder="Password" />
                  </div>
                  <div className="space-y-2">
                    <Label required className="text-xs uppercase text-muted-foreground">Mobile</Label>
                    <Input placeholder="Mobile Number" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Birthdate</Label>
                    <DatePicker />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Gender</Label>
                    <RadioGroup className="flex flex-row gap-4 pt-2" value="Male">
                      <Radio value="Male" label="Male" />
                      <Radio value="Female" label="Female" />
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">User Image</Label>
                    <Input type="file" className="text-xs py-1" />
                  </div>
                </div>
              </div>
            )}

            {addStep === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 text-primary mb-2">
                  <Briefcase className="size-5" />
                  <h3 className="font-semibold text-lg">Employment Structure</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label required className="text-xs uppercase text-muted-foreground">Department</Label>
                    <Select options={[{label: 'Administrative Support', value: 'Administrative Support'}]} placeholder="Select Department" />
                  </div>
                  <div className="space-y-2">
                    <Label required className="text-xs uppercase text-muted-foreground">Job Role</Label>
                    <Select options={[{label: 'Select Job Role', value: ''}]} placeholder="Select Job Role" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Responsibility Level</Label>
                    <Select options={[{label: '1', value: '1'}]} placeholder="Select Level" />
                  </div>
                  <div className="space-y-2">
                    <Label required className="text-xs uppercase text-muted-foreground">User Profile</Label>
                    <Select options={[{label: 'Admin', value: 'Admin'}]} placeholder="Select Profile" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Joining Year</Label>
                    <Input placeholder="YYYY" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Status</Label>
                    <Select options={[{label: 'Active', value: 'Active'}, {label: 'Inactive', value: 'Inactive'}]} placeholder="Active" />
                  </div>
                </div>
              </div>
            )}

            {addStep === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 text-primary mb-2">
                  <Shield className="size-5" />
                  <h3 className="font-semibold text-lg">Address Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label className="text-xs uppercase text-muted-foreground">Address</Label>
                    <Input placeholder="Enter Address" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-xs uppercase text-muted-foreground">Temporary Address</Label>
                    <Input placeholder="Enter Temporary Address" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">City</Label>
                    <Input placeholder="Enter City" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">State</Label>
                    <Input placeholder="Enter State" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">Pincode</Label>
                    <Input placeholder="Enter Pincode" />
                  </div>
                </div>
              </div>
            )}

            {addStep === 4 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 text-primary mb-2">
                  <Briefcase className="size-5" />
                  <h3 className="font-semibold text-lg">Reporting & Deposit</h3>
                </div>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-primary">Reporting Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground">Supervisor / Subordinate</Label>
                        <Select options={[{label: 'Supervisor', value: 'Supervisor'}, {label: 'Subordinate', value: 'Subordinate'}]} placeholder="Select" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground">Employee Name</Label>
                        <Select options={[{label: 'kalpesh . sheth', value: 'kalpesh'}]} placeholder="Select Employee" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground">Reporting Method</Label>
                        <Select options={[{label: 'Direct', value: 'Direct'}, {label: 'Indirect', value: 'Indirect'}]} placeholder="Select Method" />
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-border/40 pt-4">
                    <h4 className="text-sm font-semibold mb-3 text-primary">Deposit Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground">Bank Name</Label>
                        <Input placeholder="Enter Bank Name" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground">Branch Name</Label>
                        <Input placeholder="Enter Branch Name" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground">Account Number</Label>
                        <Input placeholder="Enter Account Number" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground">IFSC Code</Label>
                        <Input placeholder="Enter IFSC Code" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground">Amount</Label>
                        <Input placeholder="Enter Amount" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground">Transfer Type</Label>
                        <Select options={[{label: 'Select Type', value: ''}]} placeholder="Select Type" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {addStep === 5 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 text-primary mb-2">
                  <Shield className="size-5" />
                  <h3 className="font-semibold text-lg">Attendance Setup</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Working Days</Label>
                    <div className="flex flex-wrap gap-4">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <label key={day} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                          <Checkbox defaultChecked /> {day}
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-y-3 gap-x-6 bg-surface-muted/30 p-4 rounded-xl border border-border/40">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Day</div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase">In Time</div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Out Time</div>
                    
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                      <React.Fragment key={day}>
                        <div className="flex items-center text-sm font-medium text-foreground">{day}</div>
                        <TimePicker value="09:00" />
                        <TimePicker value="18:00" />
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between p-6 border-t border-border/40 bg-surface/50 relative z-10">
            <Button variant="ghost" onClick={() => addStep > 1 ? setAddStep(addStep - 1) : setIsAddSheetOpen(false)} className="cursor-pointer">
              {addStep > 1 ? 'Back' : 'Cancel'}
            </Button>
            {addStep < 5 ? (
              <Button onClick={() => setAddStep(addStep + 1)} className="rounded-md px-6 shadow-sm cursor-pointer">
                Next Step
              </Button>
            ) : (
              <Button className="rounded-md px-6 shadow-md cursor-pointer" onClick={() => setIsAddSheetOpen(false)}>
                Complete Onboarding
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* --- EMPLOYEE OVERVIEW SHEET (Premium Profile View) --- */}
      <Sheet open={!!activeEmployee} onOpenChange={(open) => !open && setActiveEmployee(null)}>
        <SheetContent side="right" className="w-[95vw] sm:max-w-4xl p-0 flex flex-col border-l">
          {activeEmployee && (
            <div className="flex flex-col h-full bg-background">
              {/* Header */}
              <div className="px-6 py-5 border-b flex items-center justify-between bg-surface">
                <div className="flex items-center gap-4">
                  {activeEmployee.image ? (
                    <img src={activeEmployee.image} alt={activeEmployee.full_name} className="size-14 rounded-full object-cover border-2 shadow-sm border-background" />
                  ) : (
                    <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary border-2 shadow-sm border-background">
                      <User className="size-6" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{activeEmployee.full_name}</h2>
                    <p className="text-sm font-medium text-muted-foreground">{activeEmployee.jobRole}</p>
                  </div>
                </div>
              </div>

              {/* Top Tabs */}
              <div className="border-b overflow-x-auto scrollbar-hide px-6 bg-surface-muted/30">
                <div className="flex space-x-1 py-2">
                  {topTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTopTab(tab.id)}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-95",
                        activeTopTab === tab.id
                          ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content Area */}
              <div key={activeTopTab} className="flex-1 overflow-hidden p-6 bg-surface animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTopTab === 'personal-info' && (
                  <PersonalInfoTab 
                    employee={activeEmployee} 
                    departments={[]} 
                    jobRoles={[]} 
                    onSave={() => {}} 
                  />
                )}
                {activeTopTab === 'upload-docs' && (
                  <UploadDocTab 
                    employee={activeEmployee} 
                    documentTypes={[
                      { id: 1, document_type: 'Resume' },
                      { id: 2, document_type: 'Offer Letter' },
                      { id: 3, document_type: 'ID Proof' },
                      { id: 4, document_type: 'Address Proof' }
                    ]} 
                    documentLists={[]} 
                  />
                )}
                {activeTopTab === 'jobrole-skill' && (
                  <JobroleSkillTab
                    employee={activeEmployee}
                    skills={[
                      {
                        skill_id: 1,
                        skill: 'Web Application Development',
                        knowledge: ['Understands React lifecycle', 'Familiar with state management (Redux/Zustand)', 'Understands REST APIs'],
                        ability: ['Can build responsive UI', 'Can integrate APIs effectively'],
                        attitude: ['Proactive problem solver', 'Eager to learn new technologies'],
                        behaviour: ['Collaborates well with backend engineers', 'Writes clean, self-documenting code']
                      },
                      {
                        skill_id: 2,
                        skill: 'Database Design',
                        knowledge: ['Understands Normalization', 'Knows SQL indexing'],
                        ability: ['Can write complex joins', 'Can optimize slow queries'],
                        attitude: ['Detail-oriented with data structures'],
                        behaviour: ['Communicates schema changes clearly']
                      }
                    ]}
                  />
                )}
                {activeTopTab === 'jobrole-tasks' && (
                  <JobroleTasksTab
                    tasks={[
                      {
                        id: 1,
                        critical_work_function: "System Architecture",
                        task: "Design scalable backend systems to support high concurrency."
                      },
                      {
                        id: 2,
                        critical_work_function: "System Architecture",
                        task: "Ensure high availability and fault tolerance in database clusters."
                      },
                      {
                        id: 3,
                        critical_work_function: "Frontend Development",
                        task: "Develop modern, responsive user interfaces using React and Tailwind CSS."
                      },
                      {
                        id: 4,
                        critical_work_function: "Frontend Development",
                        task: "Implement accessibility standards (WCAG) across all web applications."
                      },
                      {
                        id: 5,
                        critical_work_function: "Code Quality & Testing",
                        task: "Write comprehensive unit and integration tests for critical business logic."
                      }
                    ]}
                  />
                )}
                {activeTopTab === 'responsibility' && (
                  <LorTab
                    data={{
                      level: "5",
                      guiding_phrase: "Ensure, advise",
                      essence_level: "Works under broad direction. Work is often self-initiated. Is fully responsible for meeting allocated technical and/or project/supervisory objectives. Establishes milestones and has a significant role in the assignment of tasks and/or responsibilities.",
                      guidance_note: "Performs an extensive range and variety of complex technical and/or professional work activities. Undertakes work which requires the application of fundamental principles in a wide and often unpredictable range of contexts. Understands the relationship between own specialism and wider customer/organisational requirements.",
                      Attributes: {
                        "Autonomy": {
                          attribute_name: "Autonomy",
                          attribute_overall_description: "Works under broad direction. Work is often self-initiated. Is fully responsible for meeting allocated technical and/or project/supervisory objectives."
                        },
                        "Influence": {
                          attribute_name: "Influence",
                          attribute_overall_description: "Influences organisation, customers, suppliers, partners and peers on the contribution of own specialism. Builds appropriate and effective business relationships."
                        },
                        "Complexity": {
                          attribute_name: "Complexity",
                          attribute_overall_description: "Performs an extensive range and variety of complex technical and/or professional work activities. Undertakes work which requires the application of fundamental principles."
                        }
                      },
                      Business_skills: {
                        "Communication": {
                          attribute_name: "Communication",
                          attribute_overall_description: "Demonstrates leadership. Facilitates collaboration between stakeholders who have diverse objectives."
                        },
                        "Problem Solving": {
                          attribute_name: "Problem Solving",
                          attribute_overall_description: "Analyses requirements and advises on scope and options for continuous operational improvement. Demonstrates creativity, innovation and ethical thinking."
                        }
                      }
                    }}
                  />
                )}
                {activeTopTab === 'skill-rating' && (
                  <CompetencyRatingTab
                    data={{
                      Skill: [
                        { id: "s1", title: "React Development", description: "Ability to build responsive and performant user interfaces using React hooks, context, and state management libraries.", current_level: null, max_level: 5 },
                        { id: "s2", title: "API Integration", description: "Proficiency in consuming RESTful APIs, handling error states, and managing asynchronous data fetching.", current_level: 3, max_level: 5 },
                        { id: "s3", title: "System Design", description: "Ability to design scalable architecture for front-end and back-end services.", current_level: null, max_level: 5 }
                      ],
                      Knowledge: [
                        { id: "k1", title: "Web Accessibility (WCAG)", description: "Understanding of ARIA roles, semantic HTML, and accessibility guidelines.", current_level: 4, max_level: 5 },
                        { id: "k2", title: "Security Best Practices", description: "Knowledge of XSS, CSRF, and how to mitigate common web vulnerabilities.", current_level: null, max_level: 5 }
                      ],
                      Ability: [
                        { id: "a1", title: "Problem Solving", description: "Ability to debug complex production issues and find root causes efficiently.", current_level: 5, max_level: 5 }
                      ],
                      Attitude: [
                        { id: "at1", title: "Continuous Learning", description: "Proactively seeks to learn new technologies and methodologies.", current_level: null, max_level: 5 }
                      ],
                      Behaviour: [
                        { id: "b1", title: "Team Collaboration", description: "Works effectively with cross-functional teams, product managers, and designers.", current_level: 4, max_level: 5 },
                        { id: "b2", title: "Mentorship", description: "Willingness to guide and mentor junior developers in the team.", current_level: null, max_level: 5 }
                      ]
                    }}
                  />
                )}
                {activeTopTab === 'expected-competency' && (
                  <ExpectedCompetencyTab
                    data={{
                      Skill: [
                        { id: "s1", title: "React Development", description: "Build responsive and performant user interfaces.", expectedLevel: 4, actualLevel: 4 },
                        { id: "s2", title: "API Integration", description: "Consume RESTful APIs and manage asynchronous data fetching.", expectedLevel: 4, actualLevel: 3 },
                        { id: "s3", title: "System Design", description: "Design scalable architecture for web services.", expectedLevel: 3, actualLevel: 4 }
                      ],
                      Knowledge: [
                        { id: "k1", title: "Web Accessibility (WCAG)", description: "Understanding of ARIA roles and semantic HTML.", expectedLevel: 3, actualLevel: 3 },
                        { id: "k2", title: "Security Best Practices", description: "Knowledge of XSS, CSRF mitigation.", expectedLevel: 4, actualLevel: 2 }
                      ],
                      Ability: [
                        { id: "a1", title: "Problem Solving", description: "Debug complex production issues.", expectedLevel: 4, actualLevel: 5 }
                      ],
                      Attitude: [
                        { id: "at1", title: "Continuous Learning", description: "Proactively seeks to learn new technologies.", expectedLevel: 5, actualLevel: 5 }
                      ],
                      Behaviour: [
                        { id: "b1", title: "Team Collaboration", description: "Works effectively with cross-functional teams.", expectedLevel: 4, actualLevel: 4 },
                        { id: "b2", title: "Mentorship", description: "Willingness to guide junior developers.", expectedLevel: 3, actualLevel: 2 }
                      ]
                    }}
                  />
                )}
                {activeTopTab !== 'personal-info' && activeTopTab !== 'upload-docs' && activeTopTab !== 'jobrole-skill' && activeTopTab !== 'jobrole-tasks' && activeTopTab !== 'responsibility' && activeTopTab !== 'skill-rating' && activeTopTab !== 'expected-competency' && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                    <div className="p-4 rounded-full bg-muted/50">
                      <Briefcase className="size-8 opacity-50" />
                    </div>
                    <p>The "{topTabs.find(t => t.id === activeTopTab)?.label}" tab is under construction.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
