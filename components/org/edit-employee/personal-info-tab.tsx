import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { Select } from '@/components/ui/select';
import { RadioGroup, Radio } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { User, MapPin, Building2, Clock, Wallet, AlertCircle } from "lucide-react";

interface PersonalInfoTabProps {
  employee: any;
  departments: any[];
  jobRoles: any[];
  onSave: (data: any) => void;
}

export function PersonalInfoTab({ employee, departments, jobRoles, onSave }: PersonalInfoTabProps) {
  const [activeSection, setActiveSection] = React.useState('personal');

  const sections = [
    { id: 'personal', label: 'Personal Details', icon: User },
    { id: 'address', label: 'Address', icon: MapPin },
    { id: 'reporting', label: 'Reporting', icon: Building2 },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'deposit', label: 'Direct Deposit', icon: Wallet },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({});
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full relative animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Sidebar navigation for sub-sections */}
      <div className="w-full md:w-48 shrink-0 flex flex-row md:flex-col gap-2 overflow-x-auto pb-2 border-b md:border-b-0 md:border-r border-border/50 pr-4">
        {sections.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap cursor-pointer ${
                isActive 
                  ? 'bg-primary text-primary-foreground font-medium shadow-sm' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {sec.label}
            </button>
          );
        })}
      </div>

      {/* Main Form Content */}
      <div className="flex-1 overflow-y-auto pr-2 pb-16">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {activeSection === 'personal' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">Personal Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Suffix</Label>
                  <Select options={[{label: 'Mr.', value: 'Mr.'}, {label: 'Mrs.', value: 'Mrs.'}, {label: 'Ms.', value: 'Ms.'}, {label: 'Dr.', value: 'Dr.'}]} placeholder="Select" />
                </div>
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input defaultValue={employee?.first_name || employee?.full_name?.split(' ')[0]} placeholder="First Name" />
                </div>
                <div className="space-y-2">
                  <Label>Middle Name</Label>
                  <Input defaultValue={employee?.middle_name} placeholder="Middle Name" />
                </div>
                
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input defaultValue={employee?.last_name || employee?.full_name?.split(' ')[1]} placeholder="Last Name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" defaultValue={employee?.email} placeholder="Email Address" />
                </div>
                
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" placeholder="••••••••" />
                </div>

                <div className="space-y-2">
                  <Label>Birthdate</Label>
                  <DatePicker value={employee?.birthdate ? new Date(employee.birthdate) : undefined} />
                </div>
                <div className="space-y-2">
                  <Label>Mobile</Label>
                  <Input type="tel" defaultValue={employee?.mobile} placeholder="Mobile Number" />
                </div>

                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select 
                    placeholder="Select Department"
                    options={departments?.map((d: any) => ({label: d.name || d, value: d.id || d})) || []} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Job Role</Label>
                  <Select 
                    placeholder="Select Job Role"
                    options={jobRoles?.map((r: any) => ({label: r.name || r, value: r.id || r})) || []} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Responsibility Level</Label>
                  <Select placeholder="Level of Responsibility" options={[]} />
                </div>

                <div className="space-y-2">
                  <Label>Gender</Label>
                  <RadioGroup className="flex flex-row gap-4 h-10 items-center" value={employee?.gender === 'F' ? 'F' : 'M'}>
                    <Radio value="M" label="Male" />
                    <Radio value="F" label="Female" />
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>User Profile</Label>
                  <Select placeholder="User Profile" options={[]} />
                </div>

                <div className="space-y-2">
                  <Label>Join Year</Label>
                  <Select 
                    placeholder="Select Year"
                    options={[2020, 2021, 2022, 2023, 2024, 2025].map(y => ({label: y.toString(), value: y.toString()}))} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    placeholder="Status"
                    value={employee?.status || "Active"}
                    options={[
                      {label: "Active", value: "Active"},
                      {label: "Inactive", value: "Inactive"},
                      {label: "Away", value: "Away"}
                    ]} 
                  />
                </div>

                <div className="space-y-2 col-span-full">
                  <Label>Profile Image</Label>
                  <Input type="file" accept="image/*" />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'address' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">Address Details</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Street Address</Label>
                  <Input defaultValue={employee?.address} placeholder="123 Main St" />
                </div>
                <div className="space-y-2">
                  <Label>Address Line 2</Label>
                  <Input defaultValue={employee?.address_2} placeholder="Apt, Suite, Bldg" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input defaultValue={employee?.city} placeholder="City" />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input defaultValue={employee?.state} placeholder="State" />
                  </div>
                  <div className="space-y-2">
                    <Label>Pincode</Label>
                    <Input defaultValue={employee?.pincode} placeholder="Pincode" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'reporting' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">Reporting Structure</h3>
              <p className="text-sm text-muted-foreground">Assign managers and reporting methods here.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supervisor Opt</Label>
                  <div className="flex items-center gap-4 h-10">
                    <RadioGroup className="flex flex-row gap-4 h-10 items-center" value="Supervisor">
                      <Radio value="Supervisor" label="Supervisor" />
                      <Radio value="Subordinate" label="Subordinate" />
                    </RadioGroup>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Employee Name</Label>
                  <Select placeholder="Select Employee" options={[]} />
                </div>
                <div className="space-y-2 col-span-full">
                  <Label>Reporting Method</Label>
                  <Input placeholder="Reporting Method" />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'attendance' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">Attendance & Schedule</h3>
              <p className="text-sm text-muted-foreground">Manage working days and shifts.</p>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Working Days</Label>
                  <div className="flex flex-wrap gap-4 pt-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <label key={day} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox defaultChecked={['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(day)} />
                        {day}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  <Label className="text-sm font-semibold border-b pb-1">Shift Timings</Label>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                    <div key={day} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <span className="text-sm font-medium">{day}</span>
                      <TimePicker value="09:00" />
                      <TimePicker value="18:00" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'deposit' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">Direct Deposit</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input placeholder="Bank Name" />
                </div>
                <div className="space-y-2">
                  <Label>Branch Name</Label>
                  <Input placeholder="Branch Name" />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input placeholder="Account No" />
                </div>
                <div className="space-y-2">
                  <Label>IFSC Code</Label>
                  <Input placeholder="IFSC Code" />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Transfer Type</Label>
                  <Select 
                    placeholder="Select Type"
                    options={[
                      {label: "Fixed Amount", value: "Fixed"},
                      {label: "Percentage", value: "Percentage"}
                    ]} 
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sticky Action Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t flex items-center justify-between z-10">
            <p className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-alert w-3.5 h-3.5" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line></svg> Please review all items carefully before saving your changes.
            </p>
            <div className="flex gap-3 w-full sm:w-auto">
              <button type="button" tabIndex={0} data-slot="button" className="group/button inline-flex items-center justify-center rounded-lg border bg-clip-padding whitespace-nowrap transition-all duration-200 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] cursor-pointer disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 font-semibold text-xs h-9 flex-1 sm:flex-none">
                Discard
              </button>
              <button type="submit" tabIndex={0} data-slot="button" className="group/button inline-flex items-center justify-center rounded-lg border border-transparent bg-clip-padding whitespace-nowrap transition-all duration-200 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] cursor-pointer disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 bg-primary text-primary-foreground [a]:hover:bg-primary/80 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 font-semibold shadow-md text-xs h-9 flex-1 sm:flex-none">
                Save Changes
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
