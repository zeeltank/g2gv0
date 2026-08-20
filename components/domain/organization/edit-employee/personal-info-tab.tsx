'use client'

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DatePicker } from '@/components/ui/date-picker';
import { toDateOnly, fromDateOnly } from '@/lib/date-only';
import { TimePicker } from '@/components/ui/time-picker';
import { Select } from '@/components/ui/select';
import { RadioGroup, Radio } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { User, MapPin, Building2, Clock, Wallet, AlertCircle, Loader2 } from "lucide-react";

interface PersonalInfoTabProps {
  employee: any;
  departments: any[];
  jobRoles: any[];
  userProfiles?: any[];
  employeesList?: any[];
  onSave: (data: any) => Promise<void> | void;
}

export function PersonalInfoTab({ employee, departments, jobRoles, userProfiles = [], employeesList = [], onSave }: PersonalInfoTabProps) {
  const [activeSection, setActiveSection] = useState('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name_suffix: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    mobile: '',
    birthdate: '',
    gender: 'M',
    department_id: '',
    allocated_standards: '',
    user_profile_id: '',
    status: '1',
    address: '',
    address_2: '',
    city: '',
    state: '',
    pincode: '',
    supervisor_opt: '',
    employee_name: '',
    reporting_method: '',
    bank_name: '',
    branch_name: '',
    account_no: '',
    ifsc_code: '',
    amount: '',
    transfer_type: '',
  });

  useEffect(() => {
    if (employee) {
      const nameParts = (employee.full_name || '').split(' ');
      setFormData({
        name_suffix: employee.name_suffix || '',
        first_name: employee.first_name || nameParts[0] || '',
        middle_name: employee.middle_name || '',
        last_name: employee.last_name || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''),
        email: employee.email || '',
        mobile: employee.mobile || '',
        // A birthdate is three numbers, not an instant. The old
        // new Date(...).toISOString() round-trip shifted it by a day in any
        // negative-offset timezone - on a person's identity record.
        birthdate: toDateOnly(employee.birthdate),
        gender: employee.gender || 'M',
        department_id: String(employee.department_id || ''),
        allocated_standards: String(employee.allocated_standards || employee.jobrole_id || ''),
        user_profile_id: String(employee.user_profile_id || ''),
        status: String(employee.status ?? '1'),
        address: employee.address || '',
        address_2: employee.address_2 || '',
        city: employee.city || '',
        state: employee.state || '',
        pincode: employee.pincode || '',
        supervisor_opt: String(employee.supervisor_opt || ''),
        employee_name: employee.employee_name || '',
        reporting_method: employee.reporting_method || '',
        bank_name: employee.bank_name || '',
        branch_name: employee.branch_name || '',
        account_no: employee.account_no || employee.account || '',
        ifsc_code: employee.ifsc_code || employee.ifsc || '',
        amount: employee.amount || '',
        transfer_type: employee.transfer_type || '',
      });
    }
  }, [employee]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const sections = [
    { id: 'personal', label: 'Personal Details', icon: User },
    { id: 'address', label: 'Address', icon: MapPin },
    { id: 'reporting', label: 'Reporting', icon: Building2 },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'deposit', label: 'Direct Deposit', icon: Wallet },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData);
    } finally {
      setIsSubmitting(false);
    }
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
              type="button"
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
      <div className="flex-1 overflow-y-auto pr-2 pb-20">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {activeSection === 'personal' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">Personal Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Suffix</Label>
                  <Select 
                    value={formData.name_suffix}
                    onChange={(val) => handleChange('name_suffix', val)}
                    options={[{label: 'Mr.', value: 'Mr.'}, {label: 'Mrs.', value: 'Mrs.'}, {label: 'Ms.', value: 'Ms.'}, {label: 'Dr.', value: 'Dr.'}]} 
                    placeholder="Select" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={formData.first_name} onChange={(e) => handleChange('first_name', e.target.value)} placeholder="First Name" required />
                </div>
                <div className="space-y-2">
                  <Label>Middle Name</Label>
                  <Input value={formData.middle_name} onChange={(e) => handleChange('middle_name', e.target.value)} placeholder="Middle Name" />
                </div>
                
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={formData.last_name} onChange={(e) => handleChange('last_name', e.target.value)} placeholder="Last Name" required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="Email Address" required />
                </div>
                
                <div className="space-y-2">
                  <Label>Birthdate</Label>
                  <DatePicker 
                    value={fromDateOnly(formData.birthdate)}
                    onChange={(d) => handleChange('birthdate', toDateOnly(d))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mobile</Label>
                  <Input type="tel" value={formData.mobile} onChange={(e) => handleChange('mobile', e.target.value)} placeholder="Mobile Number" />
                </div>

                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select 
                    value={formData.department_id}
                    onChange={(val) => handleChange('department_id', val)}
                    placeholder="Select Department"
                    options={departments?.map((d: any) => ({
                      label: d.department || d.name || String(d), 
                      value: String(d.id || d)
                    })) || []} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Job Role</Label>
                  <Select 
                    value={formData.allocated_standards}
                    onChange={(val) => handleChange('allocated_standards', val)}
                    placeholder="Select Job Role"
                    options={jobRoles?.map((r: any) => ({
                      label: r.jobrole || r.name || String(r), 
                      value: String(r.id || r)
                    })) || []} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Gender</Label>
                  <RadioGroup 
                    className="flex flex-row gap-4 h-10 items-center" 
                    value={formData.gender === 'F' ? 'F' : 'M'}
                    onChange={(val) => handleChange('gender', val)}
                  >
                    <Radio value="M" label="Male" />
                    <Radio value="F" label="Female" />
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>User Profile Role</Label>
                  <Select 
                    value={formData.user_profile_id}
                    onChange={(val) => handleChange('user_profile_id', val)}
                    placeholder="Select User Profile" 
                    options={userProfiles?.map((p: any) => ({
                      label: p.name || String(p),
                      value: String(p.id || p)
                    })) || []} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    placeholder="Status"
                    value={formData.status === '1' || formData.status === 'Active' ? '1' : '0'}
                    onChange={(val) => handleChange('status', val)}
                    options={[
                      {label: "Active", value: "1"},
                      {label: "Inactive", value: "0"}
                    ]} 
                  />
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
                  <Input value={formData.address} onChange={(e) => handleChange('address', e.target.value)} placeholder="123 Main St" />
                </div>
                <div className="space-y-2">
                  <Label>Address Line 2</Label>
                  <Input value={formData.address_2} onChange={(e) => handleChange('address_2', e.target.value)} placeholder="Apt, Suite, Bldg" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={formData.city} onChange={(e) => handleChange('city', e.target.value)} placeholder="City" />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input value={formData.state} onChange={(e) => handleChange('state', e.target.value)} placeholder="State" />
                  </div>
                  <div className="space-y-2">
                    <Label>Pincode</Label>
                    <Input value={formData.pincode} onChange={(e) => handleChange('pincode', e.target.value)} placeholder="Pincode" />
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
                  <Label>Reporting Manager / Supervisor</Label>
                  <Select 
                    value={formData.supervisor_opt}
                    onChange={(val) => handleChange('supervisor_opt', val)}
                    placeholder="Select Manager" 
                    options={employeesList?.map((emp: any) => ({
                      label: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.full_name || emp.user_name || String(emp.id),
                      value: String(emp.id)
                    })) || []} 
                  />
                </div>
                <div className="space-y-2 col-span-full">
                  <Label>Reporting Method</Label>
                  <Input value={formData.reporting_method} onChange={(e) => handleChange('reporting_method', e.target.value)} placeholder="Reporting Method (e.g., Direct, Matrix)" />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'attendance' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">Attendance & Schedule</h3>
              <p className="text-sm text-muted-foreground font-medium">Standard working schedule configured for this employee.</p>
              
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
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
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
                  <Input value={formData.bank_name} onChange={(e) => handleChange('bank_name', e.target.value)} placeholder="Bank Name" />
                </div>
                <div className="space-y-2">
                  <Label>Branch Name</Label>
                  <Input value={formData.branch_name} onChange={(e) => handleChange('branch_name', e.target.value)} placeholder="Branch Name" />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input value={formData.account_no} onChange={(e) => handleChange('account_no', e.target.value)} placeholder="Account No" />
                </div>
                <div className="space-y-2">
                  <Label>IFSC Code</Label>
                  <Input value={formData.ifsc_code} onChange={(e) => handleChange('ifsc_code', e.target.value)} placeholder="IFSC Code" />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" value={formData.amount} onChange={(e) => handleChange('amount', e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Transfer Type</Label>
                  <Select 
                    value={formData.transfer_type}
                    onChange={(val) => handleChange('transfer_type', val)}
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

          {/* Action Footer */}
          <div className="pt-6 border-t flex items-center justify-between z-10">
            <p className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-primary" /> Review all details carefully before saving changes.
            </p>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
