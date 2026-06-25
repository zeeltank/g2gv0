"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  FileSpreadsheet,
  ArrowRight,
  Globe,
  Phone,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { ProtectedLayout } from "@/components/auth/protected-layout";
import { SetupWizardLayout } from "@/components/settings/setup-wizard-layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SectionCard,
  ReadField,
  FormField,
  Badge,
  SelectInput,
} from "@/components/org/gtg-ui";
import { SISTER_COMPANIES, type SisterCompany } from "@/lib/gtg-org-data";
import { useAuth } from "@/lib/gtg-auth";
import { updateOnboarding } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { SetupStep } from "@/components/settings/setup-progress-tracker";

const SETUP_STEPS: SetupStep[] = [
  { id: "modules", label: "Module Selection" },
  { id: "organization", label: "Organization Details" },
  { id: "department", label: "Department Setup" },
  { id: "employee", label: "Employee Import" },
  { id: "review", label: "Portal Review" },
  { id: "golive", label: "Go Live" },
];

type WizardStep = "organization" | "departments" | "employees";

type SisterCompanyMode = "none" | "create" | "edit";

interface StepConfig {
  id: WizardStep;
  title: string;
  description: string;
}

interface OrganizationForm {
  organizationName: string;
  organizationCode: string;
  organizationType: string;
  businessType: string;
  industryType: string;
  email: string;
  phone: string;
  website: string;
  country: string;
  state: string;
  city: string;
  registrationNumber: string;
  gstNumber: string;
  panNumber: string;
  establishedDate: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  companyDescription: string;
}

interface EmployeeRow {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  joiningDate: string;
  status: "Ready" | "Needs Review";
}

const steps: StepConfig[] = [
  {
    id: "organization",
    title: "Organization Details",
    description: "Manage your organization information and preferences",
  },
  {
    id: "departments",
    title: "Department Selection",
    description: "Choose departments suggested for your industry.",
  },
  {
    id: "employees",
    title: "Employee Import",
    description: "Upload, validate, and review employee records.",
  },
];

const initialOrganization: OrganizationForm = {
  organizationName: "ABC Technologies Pvt. Ltd.",
  organizationCode: "ABC123",
  organizationType: "Company",
  businessType: "Private Limited",
  industryType: "Information Technology",
  email: "info@abctech.com",
  phone: "079-12345678",
  website: "www.abctech.com",
  country: "India",
  state: "Gujarat",
  city: "Ahmedabad",
  registrationNumber: "",
  gstNumber: "",
  panNumber: "",
  establishedDate: "",
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  companyDescription: "",
};

const getLocationParts = (location: string) => {
  const [city = "", country = ""] = location.split(",").map((part) => part.trim());
  return { city, country };
};

const getSisterCompanyOrganization = (
  company: SisterCompany,
): OrganizationForm => {
  const { city, country } = getLocationParts(company.location);

  return {
    ...initialOrganization,
    organizationName: company.name,
    organizationCode: company.code,
    organizationType: "Company",
    businessType: company.type,
    email: "",
    phone: "",
    website: "",
    country: country || initialOrganization.country,
    state: "",
    city,
    registrationNumber: "",
    gstNumber: "",
    panNumber: "",
    establishedDate: "",
    addressLine1: "",
    addressLine2: "",
    postalCode: "",
    companyDescription: `${company.name} is a ${company.type.toLowerCase()} of ${initialOrganization.organizationName}.`,
  };
};

const initialSisterCompanyForms = SISTER_COMPANIES.reduce<
  Record<string, OrganizationForm>
>((forms, company) => {
  forms[company.id] = getSisterCompanyOrganization(company);
  return forms;
}, {});

const initialNewSisterCompany: OrganizationForm = {
  ...initialOrganization,
  organizationName: "",
  organizationCode: "",
  organizationType: "Company",
  businessType: "Subsidiary",
  email: "",
  phone: "",
  website: "",
  country: "",
  state: "",
  city: "",
  registrationNumber: "",
  gstNumber: "",
  panNumber: "",
  establishedDate: "",
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  companyDescription: "",
};

const departmentSuggestions: Record<string, string[]> = {
  "Information Technology": [
    "Engineering",
    "Product Management",
    "Quality Assurance",
    "DevOps",
    "UI/UX Design",
    "Human Resources",
    "Finance",
    "Sales",
    "Marketing",
    "Customer Support",
    "Administration",
  ],
  Manufacturing: [
    "Production",
    "Quality Control",
    "Maintenance",
    "Procurement",
    "Warehouse",
    "Human Resources",
    "Finance",
    "Sales",
  ],
  Healthcare: [
    "Clinical Operations",
    "Nursing",
    "Patient Support",
    "Compliance",
    "Human Resources",
    "Finance",
    "Administration",
  ],
};

const sampleEmployees: EmployeeRow[] = [
  {
    id: "1",
    employeeId: "EMP-001",
    name: "Aarav Mehta",
    email: "aarav.mehta@abctech.com",
    department: "Engineering",
    designation: "Senior Software Engineer",
    joiningDate: "2024-04-15",
    status: "Ready",
  },
  {
    id: "2",
    employeeId: "EMP-002",
    name: "Nisha Shah",
    email: "nisha.shah@abctech.com",
    department: "Human Resources",
    designation: "HR Manager",
    joiningDate: "2023-11-01",
    status: "Ready",
  },
  {
    id: "3",
    employeeId: "EMP-003",
    name: "Rohan Iyer",
    email: "",
    department: "Quality Assurance",
    designation: "QA Analyst",
    joiningDate: "2025-01-20",
    status: "Needs Review",
  },
];

const requiredOrganizationFields: Array<keyof OrganizationForm> = [
  "organizationName",
  "organizationCode",
  "organizationType",
  "businessType",
  "industryType",
  "email",
  "phone",
  "country",
  "state",
  "city",
  "registrationNumber",
  "gstNumber",
  "panNumber",
  "establishedDate",
  "addressLine1",
  "postalCode",
  "companyDescription",
];

function getOrganizationInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials.slice(0, 3) || "ORG";
}

function getEstablishedYear(value: string) {
  const year = value.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : value || "Pending";
}

function OrganizationProfileStep({
  organization,
  updateOrganization,
  isOrganizationReady,
  saveOrganization,
  employeeCount,
  timeZone,
  currency,
  financialYear,
  language,
  updateTimeZone,
  updateCurrency,
  updateFinancialYear,
  updateLanguage,
  sisterCompanyMode,
  onSisterCompanyCreate,
  onSisterCompanyEdit,
  onSisterCompanyDelete,
}: {
  organization: OrganizationForm;
  updateOrganization: (field: keyof OrganizationForm, value: string) => void;
  isOrganizationReady: boolean;
  saveOrganization: () => void;
  employeeCount: number;
  timeZone: string;
  currency: string;
  financialYear: string;
  language: string;
  updateTimeZone: (value: string) => void;
  updateCurrency: (value: string) => void;
  updateFinancialYear: (value: string) => void;
  updateLanguage: (value: string) => void;
  sisterCompanyMode?: SisterCompanyMode;
  onSisterCompanyCreate?: () => void;
  onSisterCompanyEdit?: (company: SisterCompany) => void;
  onSisterCompanyDelete?: (id: string) => void;
}) {
  const [sisterCompanySearch, setSisterCompanySearch] = useState("");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [workingDays, setWorkingDays] = useState<string[]>([
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ]);
  const logoText = getOrganizationInitials(organization.organizationName);
  const filteredSisterCompanies = SISTER_COMPANIES.filter((company) =>
    company.name.toLowerCase().includes(sisterCompanySearch.toLowerCase()),
  );
  const settingsSummary = [
    { label: "Time Zone", value: timeZone, options: ["(IST) Asia/Kolkata", "(PST) America/Los_Angeles", "(CET) Europe/Paris"] },
    { label: "Currency", value: currency, options: ["INR - Indian Rupee (₹)", "USD - US Dollar ($)", "EUR - Euro (€)"] },
    { label: "Financial Year", value: financialYear, options: ["April - March", "January - December", "July - June"] },
    { label: "Language", value: language, options: ["English", "Hindi", "Gujarati"] },
    { label: "Number Format", value: "1,234.56" },
  ];
  const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const completeOrganization = () => {
    if (!isOrganizationReady) return;
    saveOrganization();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone="secondary">
            <Building2 className="size-3.5" aria-hidden="true" />
            {organization.organizationType}
          </Badge>
        </div>
        <Button
          type="button"
          disabled={!isOrganizationReady}
          onClick={completeOrganization}
        >
          {sisterCompanyMode === "create"
            ? "Create Sister Company"
            : sisterCompanyMode === "edit"
              ? "Save Sister Company"
              : "Save & Continue"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title="Company Logo" className="lg:col-span-1">
          <div className="flex flex-col items-center gap-4">
            <div
              className="flex size-28 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground shadow-md"
              aria-hidden="true"
            >
              {logoText}
            </div>
            <div className="flex w-full flex-col gap-3 pt-2">
              <ReadField
                label="Founded"
                value={getEstablishedYear(organization.establishedDate)}
              />
              <ReadField
                label="Total Employees"
                value={
                  employeeCount > 0 ? employeeCount.toLocaleString() : "Pending"
                }
              />
            </div>
            
          </div>
        </SectionCard>

        <SectionCard
          title="Company Details"
          description="Core registration and identity information."
          className="lg:col-span-2"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="Company Name" required>
              <Input
                value={organization.organizationName}
                onChange={(event) =>
                  updateOrganization("organizationName", event.target.value)
                }
              />
            </FormField>
            <FormField label="Company Code" required>
              <Input
                value={organization.organizationCode}
                onChange={(event) =>
                  updateOrganization("organizationCode", event.target.value)
                }
              />
            </FormField>
            <FormField label="Registration Number" required>
              <Input
                value={organization.registrationNumber}
                onChange={(event) =>
                  updateOrganization("registrationNumber", event.target.value)
                }
              />
            </FormField>
            <FormField label="Industry" required>
              <SelectInput
                value={organization.industryType}
                onChange={(value) => updateOrganization("industryType", value)}
                options={[
                  {
                    value: "Information Technology",
                    label: "Information Technology",
                  },
                  { value: "Manufacturing", label: "Manufacturing" },
                  { value: "Healthcare", label: "Healthcare" },
                ]}
              />
            </FormField>
            <FormField label="Organization Type" required>
              <SelectInput
                value={organization.organizationType}
                onChange={(value) =>
                  updateOrganization("organizationType", value)
                }
                options={[
                  { value: "Company", label: "Company" },
                  { value: "Partnership", label: "Partnership" },
                  { value: "LLP", label: "LLP" },
                  { value: "Public Limited", label: "Public Limited" },
                ]}
              />
            </FormField>
            <FormField label="Business Type" required>
              <SelectInput
                value={organization.businessType}
                onChange={(value) => updateOrganization("businessType", value)}
                options={[
                  { value: "Private Limited", label: "Private Limited" },
                  { value: "Public Limited", label: "Public Limited" },
                  { value: "Partnership", label: "Partnership" },
                  { value: "Subsidiary", label: "Subsidiary" },
                  { value: "Branch", label: "Branch" },
                ]}
              />
            </FormField>
            <FormField label="Established Date" required>
              <Input
                type="date"
                value={organization.establishedDate}
                onChange={(event) =>
                  updateOrganization("establishedDate", event.target.value)
                }
              />
            </FormField>
            <FormField label="GST No." required>
              <Input
                value={organization.gstNumber}
                onChange={(event) =>
                  updateOrganization("gstNumber", event.target.value)
                }
              />
            </FormField>
            <FormField label="PAN No." required>
              <Input
                value={organization.panNumber}
                onChange={(event) =>
                  updateOrganization("panNumber", event.target.value)
                }
              />
            </FormField>
            <FormField label="Website">
              <Input
                value={organization.website}
                onChange={(event) =>
                  updateOrganization("website", event.target.value)
                }
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Company Description" required>
                <Textarea
                  value={organization.companyDescription}
                  onChange={(event) =>
                    updateOrganization("companyDescription", event.target.value)
                  }
                  rows={3}
                />
              </FormField>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Contact Information">
          <div className="grid grid-cols-1 gap-5">
            <FormField label="Email Address" required>
              <Input
                type="email"
                value={organization.email}
                onChange={(event) =>
                  updateOrganization("email", event.target.value)
                }
              />
            </FormField>
            <FormField label="Phone Number" required>
              <Input
                value={organization.phone}
                onChange={(event) =>
                  updateOrganization("phone", event.target.value)
                }
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="Registered Address">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Address Line 1" required>
                <Input
                  value={organization.addressLine1}
                  onChange={(event) =>
                    updateOrganization("addressLine1", event.target.value)
                  }
                />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Address Line 2">
                <Input
                  value={organization.addressLine2}
                  onChange={(event) =>
                    updateOrganization("addressLine2", event.target.value)
                  }
                />
              </FormField>
            </div>
            <FormField label="City" required>
              <Input
                value={organization.city}
                onChange={(event) =>
                  updateOrganization("city", event.target.value)
                }
              />
            </FormField>
            <FormField label="State" required>
              <Input
                value={organization.state}
                onChange={(event) =>
                  updateOrganization("state", event.target.value)
                }
              />
            </FormField>
            <FormField label="Postal Code" required>
              <Input
                value={organization.postalCode}
                onChange={(event) =>
                  updateOrganization("postalCode", event.target.value)
                }
              />
            </FormField>
            <FormField label="Country" required>
              <Input
                value={organization.country}
                onChange={(event) =>
                  updateOrganization("country", event.target.value)
                }
              />
            </FormField>
          </div>
        </SectionCard>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground">
              <Building2 className="size-5 text-primary" aria-hidden="true" />
              Sister Companies
            </h3>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="self-start border-primary/40 text-primary md:self-auto"
              onClick={onSisterCompanyCreate}
            >
              <Plus aria-hidden="true" />
              Add Sister Company
            </Button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={sisterCompanySearch}
                onChange={(event) => setSisterCompanySearch(event.target.value)}
                placeholder="Search companies..."
                className="h-9 pr-9 text-sm"
              />
            </div>
            <Button variant="outline" size="sm" type="button">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filter
            </Button>
          </div>

          <div className="overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 text-[11px] normal-case text-foreground">
                    Company Name
                  </TableHead>
                  <TableHead className="h-10 text-[11px] normal-case text-foreground">
                    Relationship Type
                  </TableHead>
                  <TableHead className="h-10 text-[11px] normal-case text-foreground">
                    Status
                  </TableHead>
                  <TableHead className="h-10 text-center text-[11px] normal-case text-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSisterCompanies.map((company, index) => {
                  const isActive = index < 2;

                  return (
                    <TableRow key={company.id}>
                      <TableCell className="py-3 text-sm font-medium text-foreground">
                        {company.name}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        Sister Company
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          tone={isActive ? "success" : "destructive"}
                          className="rounded-md px-2 py-1 text-[11px]"
                        >
                          {isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            type="button"
                            aria-label={`Edit ${company.name}`}
                            onClick={() => onSisterCompanyEdit?.(company)}
                          >
                            <Edit2 className="size-4 text-primary" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            type="button"
                            aria-label={`Delete ${company.name}`}
                            onClick={() => onSisterCompanyDelete?.(company.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {filteredSisterCompanies.length > 0 ? 1 : 0} to{" "}
              {filteredSisterCompanies.length} of{" "}
              {filteredSisterCompanies.length} entries
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="icon-sm"
                variant="outline"
                type="button"
                disabled
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="icon-sm" type="button" aria-label="Page 1">
                1
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                type="button"
                disabled
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card px-5 py-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="inline-flex items-center gap-2 text-base font-semibold leading-none text-foreground">
              <Settings className="size-4 text-primary" aria-hidden="true" />
              Settings (Overview)
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
              {settingsSummary.map((item) => (
                <div key={item.label} className="min-w-0">
                  <label className="text-xs font-semibold text-foreground">
                    {item.label}
                  </label>
                  {item.label === "Language" ? (
                    <select
                      value={item.value}
                      onChange={(event) => updateLanguage(event.target.value)}
                      className="mt-2 flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {item.options?.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  ) : item.label === "Time Zone" ? (
                    <select
                      value={item.value}
                      onChange={(event) => updateTimeZone(event.target.value)}
                      className="mt-2 flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {item.options?.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  ) : item.label === "Currency" ? (
                    <select
                      value={item.value}
                      onChange={(event) => updateCurrency(event.target.value)}
                      className="mt-2 flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {item.options?.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  ) : item.label === "Financial Year" ? (
                    <select
                      value={item.value}
                      onChange={(event) => updateFinancialYear(event.target.value)}
                      className="mt-2 flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {item.options?.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  ) : (
                    <Input
                      defaultValue={item.value}
                      className="mt-2 h-9 text-sm"
                    />
                  )}
                </div>
              ))}
              <div >
                <p className="text-xs font-semibold text-foreground">
                  Date Format
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">

                  <Input
                    type="date"
                    className="h-9 w-40 text-sm"
                  />
                </div>
              </div>
              <div >
                <p className="text-xs font-semibold text-foreground">
                  Number Format
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Input
                    defaultValue="1,234.56"
                    className="h-9 w-32 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">
                    Preview
                  </span>
                </div>
              </div>
              <div >
                <p className="text-xs font-semibold text-foreground">
                  Working Days
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {allDays.map((day) => {
                    const isSelected = workingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          setWorkingDays((current) =>
                            current.includes(day)
                              ? current.filter((item) => item !== day)
                              : [...current, day],
                          )
                        }
                        className={cn(
                          "inline-flex h-7 min-w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40",
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="self-start xl:-mt-1"
          >
            Save Settings
          </Button>
        </div>
      </div>

    </div>
  );
}

function SetupProgressRail({
  activeStep,
  completed,
}: {
    activeStep: WizardStep;
    completed: Record<WizardStep, boolean>;
}) {
  const completedCount = steps.filter((step) => completed[step.id]).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  return (
    <aside className="flex h-full flex-col rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="mb-5">
        <p className="text-sm font-semibold text-foreground">Setup Progress</p>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{progress}% Complete</span>
          <span>
            {completedCount}/{steps.length} steps
          </span>
        </div>
        <Progress value={progress} className="mt-2" />
      </div>

      <div className="space-y-0">
        {steps.map((step, index) => {
          const isCompleted = completed[step.id];
          const isCurrent = step.id === activeStep && !isCompleted;
          const status = isCompleted
            ? "Completed"
            : isCurrent
              ? "In Progress"
              : "Pending";

          return (
            <div key={step.id} className="relative flex gap-3 pb-6 last:pb-0">
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px",
                    isCompleted ? "bg-primary" : "bg-border",
                  )}
                />
              )}
              <div
                className={cn(
                  "z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  isCompleted &&
                  "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary bg-primary/10 text-primary",
                  !isCompleted &&
                  !isCurrent &&
                  "border-border bg-background text-muted-foreground",
                )}
              >
                {isCompleted ? <Check className="size-4" /> : index + 1}
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-foreground">
                  {step.title}
                </p>
                <p
                  className={cn(
                    "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    isCompleted && "bg-success/10 text-success",
                    isCurrent && "bg-primary/10 text-primary",
                    !isCompleted &&
                    !isCurrent &&
                    "bg-muted text-muted-foreground",
                  )}
                >
                  {status}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default function OrganizationSetupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState<WizardStep>("organization");
  const [completed, setCompleted] = useState<Record<WizardStep, boolean>>({
    organization: false,
    departments: false,
    employees: false,
  });

  const mainCompletedSteps = useMemo(() => {
    const completedIds: string[] = [];
    if (completed.organization) completedIds.push("organization");
    if (completed.departments) completedIds.push("department");
    if (completed.employees) completedIds.push("employee");
    return new Set(["modules", ...completedIds]);
  }, [completed]);
  const currentStep = mainCompletedSteps.size + 1;
  const [mainOrganization, setMainOrganization] =
    useState<OrganizationForm>(initialOrganization);
  const [organization, setOrganization] =
    useState<OrganizationForm>(initialOrganization);
  const [timeZone, setTimeZone] = useState("(IST) Asia/Kolkata");
  const [currency, setCurrency] = useState("INR - Indian Rupee (₹)");
  const [financialYear, setFinancialYear] = useState("April - March");
  const [language, setLanguage] = useState("English");
  const [newSisterOrganization, setNewSisterOrganization] =
    useState<OrganizationForm>(initialNewSisterCompany);
  const [sisterCompanyForms, setSisterCompanyForms] = useState<
    Record<string, OrganizationForm>
  >(initialSisterCompanyForms);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [customDepartment, setCustomDepartment] = useState("");
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sisterCompanyMode, setSisterCompanyMode] =
    useState<SisterCompanyMode>("none");
  const [editingSisterCompany, setEditingSisterCompany] = useState<SisterCompany | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const completionCount = steps.filter((step) => completed[step.id]).length;
  const isComplete = completionCount === steps.length;

  const filteredDepartments = useMemo(() => {
    const suggestions =
      departmentSuggestions[organization.industryType] ??
      departmentSuggestions["Information Technology"];

    return suggestions.filter((department) =>
      department.toLowerCase().includes(departmentSearch.toLowerCase()),
    );
  }, [departmentSearch, organization.industryType]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const search = employeeSearch.toLowerCase();
      return [
        employee.employeeId,
        employee.name,
        employee.email,
        employee.department,
        employee.designation,
        employee.status,
      ].some((value) => value.toLowerCase().includes(search));
    });
  }, [employeeSearch, employees]);

  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const visibleEmployees = filteredEmployees.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const invalidEmployees = employees.filter(
    (employee) => employee.status === "Needs Review",
  );
  const isOrganizationReady = requiredOrganizationFields.every((field) =>
    organization[field].trim(),
  );

  const updateOrganization = (field: keyof OrganizationForm, value: string) => {
    setOrganization((current) => {
      const next = { ...current, [field]: value };

      if (sisterCompanyMode === "none") {
        setMainOrganization(next);
      } else if (sisterCompanyMode === "create") {
        setNewSisterOrganization(next);
      } else if (editingSisterCompany) {
        setSisterCompanyForms((currentForms) => ({
          ...currentForms,
          [editingSisterCompany.id]: next,
        }));
      }

      return next;
    });
  };

  const completeStep = (step: WizardStep, next?: WizardStep) => {
    setCompleted((current) => ({ ...current, [step]: true }));
    if (next) setActiveStep(next);
  };

  const saveOrganization = async () => {
    const hasMissing = requiredOrganizationFields.some(
      (field) => !organization[field].trim(),
    );
    if (hasMissing) return;

    if (sisterCompanyMode !== "none") {
      if (sisterCompanyMode === "create") {
        setNewSisterOrganization(organization);
      } else if (editingSisterCompany) {
        setSisterCompanyForms((currentForms) => ({
          ...currentForms,
          [editingSisterCompany.id]: organization,
        }));
      }
      return;
    }

    if (user) {
      await updateOnboarding(user.id, {
        organization: {
          companyName: organization.organizationName,
          timeZone,
          currency,
          financialYear,
          country: organization.country,
          industry: organization.industryType,
        },
      });
    }
    completeStep("organization", "departments");
  };

  const toggleDepartment = (department: string) => {
    setSelectedDepartments((current) =>
      current.includes(department)
        ? current.filter((item) => item !== department)
        : [...current, department],
    );
  };

  const addCustomDepartment = () => {
    const value = customDepartment.trim();
    if (!value || selectedDepartments.includes(value)) return;
    setSelectedDepartments((current) => [...current, value]);
    setCustomDepartment("");
  };

  const importEmployees = () => {
    setEmployees(sampleEmployees);
    setEmployeeSearch("");
    setPage(1);
  };

  const saveDepartments = async () => {
    if (user) await updateOnboarding(user.id, { departments: selectedDepartments });
    completeStep("departments", "employees");
  };

  const saveEmployees = async () => {
    const warnings = employees.filter((employee) => employee.status === "Needs Review").length;
    if (user) {
      await updateOnboarding(user.id, {
        employees: {
          total: employees.length,
          successful: employees.length - warnings,
          warnings,
          errors: 0,
        },
      });
    }
    completeStep("employees");
  };

  const downloadTemplate = () => {
    const csv = [
      "Employee ID,Employee Name,Email,Department,Designation,Joining Date",
      "EMP-001,Aarav Mehta,aarav.mehta@abctech.com,Engineering,Software Engineer,2024-04-15",
    ].join("\n");
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = "employee-import-template.csv";
    link.click();
  };

  const deleteEmployee = (id: string) => {
    setEmployees((current) => current.filter((employee) => employee.id !== id));
  };

  const markEmployeeReady = (id: string) => {
    setEmployees((current) =>
      current.map((employee) =>
        employee.id === id
          ? {
              ...employee,
            email:
              employee.email ||
              `${employee.name.toLowerCase().replace(/\s+/g, ".")}@abctech.com`,
            status: "Ready",
            }
          : employee,
      ),
    );
  };

  const openSisterCompanyEditor = (company: SisterCompany) => {
    setEditingSisterCompany(company);
    setSisterCompanyMode("edit");
    setActiveStep("organization");
    setOrganization(sisterCompanyForms[company.id] ?? getSisterCompanyOrganization(company));
  };

  const openSisterCompanyCreator = () => {
    setEditingSisterCompany(null);
    setSisterCompanyMode("create");
    setActiveStep("organization");
    setOrganization(newSisterOrganization);
  };

  const openMainCompany = () => {
    setEditingSisterCompany(null);
    setSisterCompanyMode("none");
    setActiveStep("organization");
    setOrganization(mainOrganization);
  };

  const openCurrentSisterCompany = () => {
    if (sisterCompanyMode === "create") {
      setOrganization(newSisterOrganization);
      return;
    }

    if (editingSisterCompany) {
      setOrganization(
        sisterCompanyForms[editingSisterCompany.id] ??
        getSisterCompanyOrganization(editingSisterCompany),
      );
    }
  };

  const deleteSisterCompany = (id: string) => {
    setEditingSisterCompany(null);
    setSisterCompanyMode("none");
    setOrganization(mainOrganization);
  };

  return (
    <ProtectedLayout>
      <SetupWizardLayout currentStep={currentStep} steps={SETUP_STEPS} completedSteps={mainCompletedSteps}>
        <div className="grid h-full min-h-0 gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="h-full min-h-0 p-4 lg:sticky lg:top-4">
            <SetupProgressRail activeStep={activeStep} completed={completed} />
          </aside>
          <section className="min-w-0 flex-1 overflow-y-auto g2g-scrollbar px-4 py-6 sm:px-6 sm:py-3">
            {!isComplete && (
              <div className="sticky top-0 z-20 mb-5 rounded-lg border border-border bg-card p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-primary">
                  Step {steps.findIndex((step) => step.id === activeStep) + 1}{" "}
                  of {steps.length}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-foreground">
                  {steps.find((step) => step.id === activeStep)?.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {steps.find((step) => step.id === activeStep)?.description}
                </p>
                {sisterCompanyMode !== "none" && (
                  <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <button
                      type="button"
                      className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={openMainCompany}
                    >
                      {mainOrganization.organizationName}
                    </button>
                    <span aria-hidden="true">/</span>
                    <button
                      type="button"
                      className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={openCurrentSisterCompany}
                    >
                      {sisterCompanyMode === "create"
                        ? "New Sister Company"
                        : organization.organizationName || editingSisterCompany?.name}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeStep === "organization" && !isComplete && (
              <OrganizationProfileStep
                organization={organization}
                updateOrganization={updateOrganization}
                isOrganizationReady={isOrganizationReady}
                saveOrganization={saveOrganization}
                employeeCount={employees.length}
                timeZone={timeZone}
                currency={currency}
                financialYear={financialYear}
                language={language}
                updateTimeZone={setTimeZone}
                updateCurrency={setCurrency}
                updateFinancialYear={setFinancialYear}
                updateLanguage={setLanguage}
                sisterCompanyMode={sisterCompanyMode}
                onSisterCompanyCreate={openSisterCompanyCreator}
                onSisterCompanyEdit={openSisterCompanyEditor}
                onSisterCompanyDelete={deleteSisterCompany}
              />
            )}

            {activeStep === "departments" && !isComplete && (
              <div className="space-y-5">
                <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        Suggested Departments for {organization.industryType}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Select one or more departments to create your initial
                        organization structure.
                      </p>
                    </div>
                    <div className="relative w-full md:w-72">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={departmentSearch}
                        onChange={(event) =>
                          setDepartmentSearch(event.target.value)
                        }
                        placeholder="Search departments"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredDepartments.map((department) => (
                      <label
                        key={department}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-sm font-medium transition-colors",
                          selectedDepartments.includes(department) &&
                          "border-primary bg-primary/5 text-primary",
                        )}
                      >
                        <Checkbox
                          checked={selectedDepartments.includes(department)}
                          onChange={() => toggleDepartment(department)}
                        />
                        {department}
                      </label>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-col gap-3 rounded-lg border border-dashed border-border bg-background p-4 sm:flex-row">
                    <Input
                      value={customDepartment}
                      onChange={(event) =>
                        setCustomDepartment(event.target.value)
                      }
                      placeholder="Add new department"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addCustomDepartment}
                    >
                      <Plus className="size-4" />
                      Add New Department
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-foreground">
                    Selected Departments
                  </h3>
                  {selectedDepartments.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedDepartments.map((department) => (
                        <span
                          key={department}
                          className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                        >
                          {department}
                        </span>
                      ))}
                    </div>
                  ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No departments selected yet.
                      </p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    size="lg"
                    disabled={selectedDepartments.length === 0}
                    onClick={saveDepartments}
                  >
                    Save & Continue
                  </Button>
                </div>
              </div>
            )}

            {activeStep === "employees" && !isComplete && (
              <div className="space-y-5">
                <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        Bulk Employee Import
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Upload CSV or Excel files and review employee records
                        before saving.
                      </p>
                    </div>
                    <Button variant="outline" onClick={downloadTemplate}>
                      <Download className="size-4" />
                      Download Sample Template
                    </Button>
                  </div>

                  <div
                    className="mt-5 flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed border-primary/40 bg-primary/5 px-6 py-8 text-center"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      importEmployees();
                    }}
                  >
                    <UploadCloud className="size-10 text-primary" />
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      Drag & drop employee file here
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      CSV, XLS, or XLSX up to 10 MB
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      className="hidden"
                      onChange={importEmployees}
                    />
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileSpreadsheet className="size-4" />
                      Upload File
                    </Button>
                  </div>
                </div>

                {employees.length > 0 && (
                  <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          Imported Employees
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {employees.length} records imported.{" "}
                          {invalidEmployees.length} records need review.
                        </p>
                      </div>
                      <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={employeeSearch}
                          onChange={(event) => {
                            setEmployeeSearch(event.target.value);
                            setPage(1);
                          }}
                          placeholder="Search employees"
                          className="pl-9"
                        />
                      </div>
                    </div>

                    {invalidEmployees.length > 0 && (
                      <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
                        Validation errors found: missing email addresses must be
                        fixed before final import.
                      </div>
                    )}

                    <div className="mt-4 rounded-lg border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee ID</TableHead>
                            <TableHead>Employee Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Designation</TableHead>
                            <TableHead>Joining Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleEmployees.map((employee) => (
                            <TableRow key={employee.id}>
                              <TableCell className="font-medium">
                                {employee.employeeId}
                              </TableCell>
                              <TableCell>{employee.name}</TableCell>
                              <TableCell>
                                {employee.email || "Missing email"}
                              </TableCell>
                              <TableCell>{employee.department}</TableCell>
                              <TableCell>{employee.designation}</TableCell>
                              <TableCell>{employee.joiningDate}</TableCell>
                              <TableCell>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-1 text-xs font-semibold",
                                    employee.status === "Ready"
                                      ? "bg-success/10 text-success"
                                      : "bg-warning/10 text-warning",
                                  )}
                                >
                                  {employee.status}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label="Edit row"
                                    onClick={() =>
                                      markEmployeeReady(employee.id)
                                    }
                                  >
                                    <Edit2 className="size-4" />
                                  </Button>
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label="Delete row"
                                    onClick={() => deleteEmployee(employee.id)}
                                  >
                                    <Trash2 className="size-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {page} of {pageCount}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          disabled={page === 1}
                          onClick={() =>
                            setPage((current) => Math.max(1, current - 1))
                          }
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          disabled={page === pageCount}
                          onClick={() =>
                            setPage((current) =>
                              Math.min(pageCount, current + 1),
                            )
                          }
                          aria-label="Next page"
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    size="lg"
                    disabled={
                      employees.length === 0 || invalidEmployees.length > 0
                    }
                    onClick={saveEmployees}
                  >
                    Save & Continue
                  </Button>
                </div>
              </div>
            )}

            {isComplete && (
              <div className="rounded-lg border border-border bg-card px-6 py-14 text-center shadow-sm">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success text-success-foreground">
                  <Check className="size-7" />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-foreground">
                  Organization Setup Completed Successfully
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your organization is now configured and ready to use.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <Button onClick={() => router.push("/settings/portal-review")}>
                    Continue to Portal Review
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      router.push("/module/m1/org-setup/employee-directory")
                    }
                  >
                    Manage Employees
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </SetupWizardLayout>
    </ProtectedLayout>
  );
}
