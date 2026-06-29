'use client'

import React, { useState } from 'react'
import {
  ShieldCheck,
  Search,
  Filter,
  MoreVertical,
  ChevronDown,
  Download,
  Plus,
  RefreshCw,
  FileText,
  Clock,
  AlertCircle,
  FileBadge,
  X,
  ChevronLeft,
  ChevronRight,
  DownloadCloud,
  CheckCircle2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

export function CmCertifications() {
  const [activeTab, setActiveTab] = useState('all')
  const [selectedCert, setSelectedCert] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState('overview')

  const certifications = [
    { id: '1', name: 'PMP - Project Management Professional', empName: 'Rohan Mehta', empInitials: 'RM', dept: 'Project Management', from: '15 Apr 2024', until: '14 Apr 2027', status: 'Active', compliance: 'Compliant' },
    { id: '2', name: 'ITIL Foundation', empName: 'Priya Nair', empInitials: 'PN', dept: 'IT Service Delivery', from: '01 Jan 2024', until: '31 Dec 2025', status: 'Active', compliance: 'Compliant' },
    { id: '3', name: 'AWS Solutions Architect', empName: 'Arjun Verma', empInitials: 'AV', dept: 'Engineering', from: '10 Nov 2023', until: '09 Nov 2025', status: 'Active', compliance: 'Compliant' },
    { id: '4', name: 'ISO 27001 Lead Auditor', empName: 'Neha Kulkarni', empInitials: 'NK', dept: 'Information Security', from: '20 Mar 2023', until: '19 Mar 2024', status: 'Expired', compliance: 'Non-Compliant' },
    { id: '5', name: 'Six Sigma Green Belt', empName: 'Siddharth Rao', empInitials: 'SR', dept: 'Quality Assurance', from: '05 Jun 2023', until: '04 Jun 2026', status: 'Active', compliance: 'Compliant' },
    { id: '6', name: 'Oracle Cloud Infrastructure', empName: 'Ananya Iyer', empInitials: 'AI', dept: 'Engineering', from: '18 Aug 2023', until: '17 Aug 2025', status: 'Active', compliance: 'Compliant' },
    { id: '7', name: 'Microsoft Azure Admin', empName: 'Vikram Singh', empInitials: 'VS', dept: 'IT Operations', from: '02 Feb 2024', until: '01 Feb 2025', status: 'Active', compliance: 'Expiring Soon' },
    { id: '8', name: 'CompTIA Security+', empName: 'Karan Shah', empInitials: 'KS', dept: 'Information Security', from: '22 Apr 2022', until: '21 Apr 2024', status: 'Expired', compliance: 'Non-Compliant' },
  ]

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'Compliant': return 'success'
      case 'Non-Compliant': return 'destructive'
      case 'Expiring Soon': return 'warning'
      default: return 'default'
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 min-h-max">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-foreground" /> Certification & Compliance Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage certification requirements, track employee compliance, expiration dates, and verification.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="h-10 px-4 rounded-xl font-bold gap-2">
            <Plus className="w-4 h-4" /> Add Certification Requirement <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
          <Button variant="outline" className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2">
            <Download className="w-4 h-4" /> Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <FileBadge className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Total Certifications</p>
              <p className="text-2xl font-bold text-foreground mt-1">142</p>
              <p className="text-xs text-muted-foreground mt-1">All certifications</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Compliant Employees</p>
              <p className="text-2xl font-bold text-foreground mt-1">1,245</p>
              <p className="text-xs text-muted-foreground mt-1">85% of total</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Expiring Soon</p>
              <p className="text-2xl font-bold text-foreground mt-1">86</p>
              <p className="text-xs text-muted-foreground mt-1">Within 60 days</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Expired</p>
              <p className="text-2xl font-bold text-foreground mt-1">37</p>
              <p className="text-xs text-muted-foreground mt-1">Require attention</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Pending Verification</p>
              <p className="text-2xl font-bold text-foreground mt-1">54</p>
              <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and List wrapper */}
      <div className="flex flex-col gap-4">
        {/* Advanced Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by certification or employee..." className="h-10 pl-8 bg-background border-border" />
          </div>
          <Select options={[{label: 'Status: All', value: 'all'}, {label: 'Active', value: 'active'}]} placeholder="Status: All" className="h-10 bg-background w-32" />
          <Select options={[{label: 'Compliance: All', value: 'all'}]} placeholder="Compliance: All" className="h-10 bg-background w-36" />
          <Select options={[{label: 'Expiry: All', value: 'all'}]} placeholder="Expiry: All" className="h-10 bg-background w-32" />
          <Select options={[{label: 'Department: All', value: 'all'}]} placeholder="Department: All" className="h-10 bg-background w-40" />
          <Select options={[{label: 'Certification Type: All', value: 'all'}]} placeholder="Type: All" className="h-10 bg-background w-48" />
          <Button variant="outline" className="h-10 px-4 gap-2 bg-background border-border text-sm ml-auto">
            <Filter className="w-4 h-4" /> More Filters
          </Button>
        </div>

        {/* Tab Pills & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'All Certifications' },
              { id: 'my', label: 'My Certifications' },
              { id: 'soon', label: 'Expiring Soon' },
              { id: 'expired', label: 'Expired' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedCert(null); }}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors border ${
                  activeTab === tab.id 
                    ? 'bg-primary/10 text-primary border-primary/20' 
                    : 'bg-card text-muted-foreground border-transparent hover:bg-muted/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 px-3 gap-2 bg-background border-border text-sm">
              Bulk Actions <ChevronDown className="w-4 h-4" />
            </Button>
            <Button variant="outline" className="h-9 w-9 p-0 bg-background border-border">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Split View */}
      <div className="flex gap-6 items-stretch min-w-[1000px] h-[600px]">
        {/* Left/Main Area: Table */}
        <Card className={`flex flex-col overflow-hidden h-full transition-all duration-300 ${selectedCert ? 'w-1/2' : 'w-full'}`}>
          <div className="flex-1 overflow-auto g2g-scrollbar relative z-10 bg-card">
            <Table className="w-full text-sm">
              <TableHeader className="bg-muted/30 border-b border-border sticky top-0 z-20">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 px-4 text-center">
                    <input type="checkbox" className="rounded border-muted-foreground/30 text-primary focus:ring-primary w-4 h-4" />
                  </TableHead>
                  <TableHead className="px-4 py-3 font-bold text-foreground">Certification Name</TableHead>
                  <TableHead className="px-4 py-3 font-bold text-foreground">Employee</TableHead>
                  {!selectedCert && <TableHead className="px-4 py-3 font-bold text-foreground">Department</TableHead>}
                  <TableHead className="px-4 py-3 font-bold text-foreground">Valid From</TableHead>
                  {!selectedCert && <TableHead className="px-4 py-3 font-bold text-foreground">Valid Until</TableHead>}
                  <TableHead className="px-4 py-3 font-bold text-foreground">Status</TableHead>
                  <TableHead className="px-4 py-3 font-bold text-foreground">Compliance</TableHead>
                  <TableHead className="w-12 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {certifications.map((row) => (
                  <TableRow key={row.id} className={`hover:bg-muted/30 cursor-pointer ${selectedCert === row.id ? 'bg-primary/5' : ''}`} onClick={() => setSelectedCert(row.id)}>
                    <TableCell className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-muted-foreground/30 text-primary focus:ring-primary w-4 h-4" />
                    </TableCell>
                    <TableCell className="px-4 py-4 font-medium text-foreground max-w-[200px] truncate">
                      {row.name}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      {!selectedCert ? (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs whitespace-nowrap">{row.empName}</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-xs whitespace-nowrap">{row.empInitials}</span>
                      )}
                    </TableCell>
                    {!selectedCert && (
                      <TableCell className="px-4 py-4 text-muted-foreground text-xs">
                        {row.dept}
                      </TableCell>
                    )}
                    <TableCell className="px-4 py-4 text-muted-foreground text-xs whitespace-nowrap">
                      {row.from}
                    </TableCell>
                    {!selectedCert && (
                      <TableCell className="px-4 py-4 text-muted-foreground text-xs whitespace-nowrap">
                        {row.until}
                      </TableCell>
                    )}
                    <TableCell className="px-4 py-4">
                      <StatusBadge 
                        status={row.status === 'Active' ? 'success' : 'destructive'} 
                        label={row.status} 
                      />
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <StatusBadge 
                        status={getComplianceStatusColor(row.compliance)} 
                        label={row.compliance} 
                      />
                    </TableCell>
                    <TableCell className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none transition-colors mx-auto">
                          <MoreVertical className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Certificate</DropdownMenuItem>
                          <DropdownMenuItem>Update Status</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-500">Revoke</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-card">
            <span>Showing 1-8 of 142</span>
            <div className="flex items-center gap-2">
              <span className="mr-2">Show <Select options={[{label: '10', value: '10'}]} placeholder="10" className="w-16 h-7 inline-flex text-xs mx-1" /> per page</span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-primary text-primary-foreground border-primary">1</Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0">2</Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0">3</Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </Card>

        {/* Right Sidebar: Details Panel */}
        {selectedCert && (() => {
          const cert = certifications.find(c => c.id === selectedCert)
          return (
            <Card className="flex-1 flex flex-col overflow-hidden h-full">
              <div className="p-5 border-b border-border flex flex-col gap-4 bg-card z-10 shrink-0 relative">
                <Button 
                  variant="ghost" 
                  className="absolute top-4 right-4 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedCert(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
                <div className="pr-8">
                  <h2 className="text-lg font-bold text-foreground leading-tight">
                    {cert?.name}
                  </h2>
                </div>

                {/* Internal Tabs */}
                <div className="flex items-center gap-6 mt-2 border-b border-border/50">
                  {['Overview', 'Compliance', 'Requirements', 'Documents', 'History'].map(tab => {
                    const id = tab.toLowerCase().split(' ')[0]
                    const isActive = id === panelTab
                    return (
                      <button
                        key={tab}
                        onClick={() => setPanelTab(id)}
                        className={`pb-2 text-xs font-semibold transition-colors relative ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {tab}
                        {isActive && (
                          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <CardContent className="flex-1 overflow-auto g2g-scrollbar relative z-10 p-5 bg-card">
                {panelTab === 'overview' ? (
                  <div className="flex flex-col gap-6">
                    {/* Employee Profile Stub */}
                    <div className="flex items-center gap-4 pb-6 border-b border-border">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                        {cert?.empInitials}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-foreground">{cert?.empName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Project Manager</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{cert?.dept}</p>
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-col gap-1 items-end">
                        <div className="flex gap-2"><span>Emp ID</span> <span className="font-semibold text-foreground">EMP10023</span></div>
                        <div className="flex gap-2"><span>Email</span> <span className="font-semibold text-foreground">{cert?.empName.toLowerCase().replace(' ', '.')}@company.com</span></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Certification Type</p>
                        <p className="text-sm font-semibold text-foreground">Industry Certification</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Valid Until</p>
                        <p className="text-sm font-semibold text-foreground">{cert?.until}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Issuing Authority</p>
                        <p className="text-sm font-semibold text-foreground">PMI</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Status</p>
                        <StatusBadge status={cert?.status === 'Active' ? 'success' : 'destructive'} label={cert?.status || ''} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Certification ID</p>
                        <p className="text-sm font-semibold text-foreground">PMP-7845123</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Compliance</p>
                        <StatusBadge status={getComplianceStatusColor(cert?.compliance || '')} label={cert?.compliance || ''} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Valid From</p>
                        <p className="text-sm font-semibold text-foreground">{cert?.from}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Days to Expiry</p>
                        <p className="text-sm font-semibold text-foreground">718 days</p>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-border">
                      <h4 className="text-sm font-bold text-foreground mb-4">Documents</h4>
                      <div className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-primary" />
                          <Button variant="link" className="p-0 h-auto text-primary text-sm font-semibold">
                            PMP_Certificate_{cert?.empName.replace(' ', '')}.pdf
                          </Button>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground">Uploaded on {cert?.from}</span>
                          <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground">
                            <DownloadCloud className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-border">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-foreground">Notes</h4>
                        <Button variant="ghost" className="h-6 w-6 p-0 text-muted-foreground">
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                        Recertification required before expiry.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-12">
                    <p className="text-sm font-bold">Content for {panelTab} coming soon.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })()}
      </div>
    </div>
  )
}
