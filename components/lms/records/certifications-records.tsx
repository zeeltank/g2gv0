'use client'

import React, { useState } from 'react'
import {
  Search,
  Filter,
  Download,
  Award,
  Clock,
  History,
  AlertCircle,
  Eye,
  MoreVertical,
  X,
  BookOpen,
  User,
  CheckCircle2,
  Calendar,
  FileText,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

// ─── Dummy Data ─────────────────────────────────────────────────────────────

type CertificateStatus = 'active' | 'expiring-soon' | 'expired'

interface Certificate {
  id: string
  name: string
  course: string
  issuedOn: string
  validUntil: string
  status: CertificateStatus
  credentialId: string
  description: string
  tags: string[]
  daysToExpiry?: number
}

const STATS = [
  { label: 'Active Certificates', value: '12', sub: 'View all active', icon: Award },
  { label: 'Expiring Soon', value: '3', sub: 'Within 90 days', icon: Clock },
  { label: 'Expired Certificates', value: '2', sub: 'Require renewal', icon: AlertCircle },
  { label: 'Total Certificates Earned', value: '18', sub: 'All time', icon: Award },
]

const CERTIFICATES: Certificate[] = [
  {
    id: 'c1',
    name: 'Information Security Awareness',
    course: 'InfoSec Fundamentals',
    issuedOn: '15 Mar 2024',
    validUntil: '15 Mar 2025',
    status: 'active', // Wireframe actually shows (in 52 days) in details, but active in list. Wait, list shows 'Active', but some say 'Expiring Soon'.
    credentialId: 'ISF-2024-12345',
    description: 'This certificate is awarded upon successful completion of the Information Security Awareness training.',
    tags: ['Compliance', 'Mandatory', 'Information Security'],
    daysToExpiry: 52
  },
  {
    id: 'c2',
    name: 'Data Privacy Compliance',
    course: 'Privacy & Data Protection',
    issuedOn: '02 Jan 2024',
    validUntil: '02 Jan 2025',
    status: 'active',
    credentialId: 'DPC-2024-98765',
    description: 'Certification for data privacy regulations including GDPR and CCPA.',
    tags: ['Compliance', 'Data Privacy']
  },
  {
    id: 'c3',
    name: 'Workplace Safety',
    course: 'Workplace Safety Training',
    issuedOn: '10 Jun 2023',
    validUntil: '10 Jun 2024',
    status: 'expired',
    credentialId: 'WST-2023-45678',
    description: 'Certification for basic workplace safety protocols.',
    tags: ['Safety', 'Mandatory']
  },
  {
    id: 'c4',
    name: 'Anti-Bribery & Corruption',
    course: 'ABC Policy Training',
    issuedOn: '05 Feb 2024',
    validUntil: '05 Feb 2026',
    status: 'active',
    credentialId: 'ABC-2024-11223',
    description: 'Certification for completion of anti-bribery policies.',
    tags: ['Compliance', 'Ethics']
  },
  {
    id: 'c5',
    name: 'Customer Data Handling',
    course: 'Data Handling Standards',
    issuedOn: '20 Aug 2023',
    validUntil: '20 Aug 2024',
    status: 'expiring-soon',
    credentialId: 'CDH-2023-55667',
    description: 'Training on standards for handling sensitive customer data.',
    tags: ['Data Privacy', 'Security'],
    daysToExpiry: 22
  },
  {
    id: 'c6',
    name: 'First Aid Certification',
    course: 'First Aid Training',
    issuedOn: '12 Sep 2023',
    validUntil: '12 Sep 2025',
    status: 'active',
    credentialId: 'FAC-2023-99887',
    description: 'Certified First Aider status.',
    tags: ['Health', 'Safety']
  },
  {
    id: 'c7',
    name: 'Diversity & Inclusion',
    course: 'D&I Awareness',
    issuedOn: '30 Nov 2023',
    validUntil: '30 Nov 2024',
    status: 'expiring-soon',
    credentialId: 'DNI-2023-33445',
    description: 'Awareness training for a diverse workplace.',
    tags: ['HR', 'Culture'],
    daysToExpiry: 80
  },
  {
    id: 'c8',
    name: 'Harassment Prevention',
    course: 'Prevention of Harassment',
    issuedOn: '18 Jan 2024',
    validUntil: '18 Jan 2024', // Wait, wireframe shows 18 Jan 2024 to 18 Jan 2024 (expired)
    status: 'expired',
    credentialId: 'POH-2024-66778',
    description: 'Mandatory prevention of harassment training.',
    tags: ['HR', 'Mandatory']
  },
]

const getStatusDetails = (status: CertificateStatus) => {
  switch (status) {
    case 'active':
      return { variant: 'active' as const, label: 'Active' }
    case 'expiring-soon':
      return { variant: 'warning' as const, label: 'Expiring Soon' }
    case 'expired':
      return { variant: 'error' as const, label: 'Expired' }
  }
}

// ─── Components ─────────────────────────────────────────────────────────────

export function CertificationsRecords() {
  const [activeTab, setActiveTab] = useState('certificates')
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null)

  const tabs = [
    { id: 'certificates', label: 'Certificates' },
    { id: 'transcript', label: 'Learning Transcript' },
    { id: 'history', label: 'Completion History' },
    { id: 'renewals', label: 'Renewals Due' },
  ]

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Certifications & Learning Records
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View your certificates, learning transcripts, completion history and renewal status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-9">
            <Download className="mr-2 size-4" /> Export
          </Button>
          <Button size="sm" className="h-9 bg-primary text-primary-foreground">
            <Download className="mr-2 size-4" /> Download Transcript
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative flex items-center gap-2 -mb-px pb-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap',
              activeTab === tab.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'certificates' && (
        <div className="flex flex-col gap-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((stat, i) => {
              const Icon = stat.icon
              return (
                <Card key={i} className="shadow-sm">
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                        {stat.label}
                      </span>
                      <div className="text-3xl font-bold text-foreground mt-1">
                        {stat.value}
                      </div>
                      <span className="text-xs text-muted-foreground truncate mt-1">
                        {stat.sub}
                      </span>
                    </div>
                    <div className="size-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0 border border-border/50">
                      <Icon className="size-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Toolbar & Table */}
          <Card className="shadow-sm border-border/60">
            <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="relative w-full sm:w-[320px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search certificates..."
                  className="w-full h-9 pl-9 pr-4 rounded-md border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button variant="outline" size="sm" className="h-9">
                  <Filter className="mr-2 size-4" /> Filters
                </Button>
                <select className="h-9 rounded-md border border-border bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-ring min-w-[120px]">
                  <option>All Status</option>
                  <option>Active</option>
                  <option>Expiring Soon</option>
                  <option>Expired</option>
                </select>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <Calendar className="size-4" /> Date Range <ChevronRight className="size-3 rotate-90" />
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10 text-center">
                    <input type="checkbox" className="rounded border-input" />
                  </TableHead>
                  <TableHead className="font-semibold">Certificate Name</TableHead>
                  <TableHead className="font-semibold">Course</TableHead>
                  <TableHead className="font-semibold">Issued On</TableHead>
                  <TableHead className="font-semibold">Valid Until</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CERTIFICATES.map((cert) => {
                  const statusInfo = getStatusDetails(cert.status)
                  return (
                    <TableRow 
                      key={cert.id} 
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setSelectedCert(cert)}
                    >
                      <TableCell className="text-center">
                        <input type="checkbox" className="rounded border-input" onClick={e => e.stopPropagation()} />
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {cert.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cert.course}
                      </TableCell>
                      <TableCell>{cert.issuedOn}</TableCell>
                      <TableCell>{cert.validUntil}</TableCell>
                      <TableCell>
                        <StatusBadge variant={statusInfo.variant} className="font-medium">
                          {statusInfo.label}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => setSelectedCert(cert)}>
                            <Eye className="size-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8">
                            <Download className="size-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreVertical className="size-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/60">
              <span className="text-sm text-muted-foreground">
                Showing 1 to 8 of 18 results
              </span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <select className="h-8 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none">
                    <option>10 per page</option>
                    <option>20 per page</option>
                    <option>50 per page</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="size-8 text-muted-foreground" disabled>
                    <ChevronLeft className="size-4 shrink-0" />
                    <ChevronLeft className="size-4 shrink-0 -ml-2" />
                  </Button>
                  <Button variant="outline" size="icon" className="size-8 text-muted-foreground" disabled>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="size-8 bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground">1</Button>
                  <Button variant="outline" size="icon" className="size-8">2</Button>
                  <Button variant="outline" size="icon" className="size-8">
                    <ChevronRight className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="size-8">
                    <ChevronRight className="size-4 shrink-0" />
                    <ChevronRight className="size-4 shrink-0 -ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedCert} onOpenChange={(open) => !open && setSelectedCert(null)}>
        <SheetContent side="right" className="w-[95vw] sm:max-w-4xl p-0 flex flex-col border-l border-border/60">
          {selectedCert && (
            <>
              {/* Header */}
              <div className="p-6 border-b border-border/60 bg-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="pr-6">
                    <h2 className="text-xl font-bold tracking-tight text-foreground leading-tight mb-3">
                      {selectedCert.name}
                    </h2>
                    <div className="flex items-center gap-3">
                      <StatusBadge variant={getStatusDetails(selectedCert.status).variant}>
                        {getStatusDetails(selectedCert.status).label}
                      </StatusBadge>
                      <span className="text-sm text-muted-foreground">
                        Certificate ID: {selectedCert.credentialId}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="size-8 shrink-0 -mr-2 -mt-2" onClick={() => setSelectedCert(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-6 border-b border-border/60 bg-card flex items-center gap-5 overflow-x-auto g2g-scrollbar">
                <button className="py-3 text-sm font-semibold text-primary border-b-2 border-primary -mb-px whitespace-nowrap">
                  Overview
                </button>
                <button className="py-3 text-sm font-medium text-muted-foreground hover:text-foreground whitespace-nowrap">
                  Details
                </button>
                <button className="py-3 text-sm font-medium text-muted-foreground hover:text-foreground whitespace-nowrap">
                  Renewal
                </button>
                <button className="py-3 text-sm font-medium text-muted-foreground hover:text-foreground whitespace-nowrap">
                  Attachments
                </button>
                <button className="py-3 text-sm font-medium text-muted-foreground hover:text-foreground whitespace-nowrap">
                  Activity
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 bg-background">
                
                {/* Visual Preview & Quick Meta */}
                <div className="flex flex-col sm:flex-row gap-6">
                  {/* Visual Preview Placeholder */}
                  <div className="w-[160px] h-[120px] bg-muted border border-border rounded-md flex items-center justify-center shrink-0 relative overflow-hidden shadow-sm">
                    <FileText className="size-12 text-muted-foreground/30" />
                    <div className="absolute bottom-2 right-2 size-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <Award className="size-3 text-primary" />
                    </div>
                    {/* Simulated lines */}
                    <div className="absolute top-4 left-4 w-12 h-1 bg-border/80 rounded-full" />
                    <div className="absolute top-8 left-4 w-24 h-1 bg-border/80 rounded-full" />
                    <div className="absolute top-12 left-4 w-20 h-1 bg-border/80 rounded-full" />
                  </div>
                  
                  <div className="flex flex-col gap-3 justify-center">
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                      <span className="text-xs text-muted-foreground font-medium">Course</span>
                      <span className="text-sm font-medium text-foreground">{selectedCert.course}</span>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                      <span className="text-xs text-muted-foreground font-medium">Issued On</span>
                      <span className="text-sm font-medium text-foreground">{selectedCert.issuedOn}</span>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                      <span className="text-xs text-muted-foreground font-medium">Valid Until</span>
                      <span className="text-sm font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                        {selectedCert.validUntil}
                        {selectedCert.status === 'expiring-soon' && (
                          <span className="text-xs text-amber-500 font-semibold">(in {selectedCert.daysToExpiry} days)</span>
                        )}
                        {selectedCert.status === 'expired' && (
                          <span className="text-xs text-destructive font-semibold">(Expired)</span>
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                      <span className="text-xs text-muted-foreground font-medium">Credential ID</span>
                      <span className="text-sm font-medium text-foreground">{selectedCert.credentialId}</span>
                    </div>
                  </div>
                </div>

                <Button variant="outline" className="w-full flex items-center justify-center gap-2 border-primary text-primary hover:bg-primary/5">
                  <Download className="size-4" /> Download Certificate
                </Button>

                <div className="h-px bg-border/60 w-full" />

                {/* Description */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Description</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedCert.description}
                  </p>
                </div>

                {/* Related Information */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Related Information</h3>
                  
                  <div className="flex items-center justify-between p-3 rounded-md border border-border/60 bg-card">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-md text-muted-foreground">
                        <BookOpen className="size-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-muted-foreground">Course</span>
                        <span className="text-sm font-medium">{selectedCert.course}</span>
                      </div>
                    </div>
                    <Button variant="link" size="sm" className="text-primary h-auto p-0">
                      View Course
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-md border border-border/60 bg-card">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-md text-muted-foreground">
                        <User className="size-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-muted-foreground">Issued To</span>
                        <span className="text-sm font-medium">John Doe</span>
                        <span className="text-xs text-muted-foreground">Employee ID: EMP-10052</span>
                      </div>
                    </div>
                    <Button variant="link" size="sm" className="text-primary h-auto p-0">
                      View Profile
                    </Button>
                  </div>
                </div>

                {/* Tags */}
                {selectedCert.tags && selectedCert.tags.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-foreground">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCert.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="font-normal bg-muted text-muted-foreground">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
