// 'use client'

// import { ArrowRight } from 'lucide-react'

// import { Button } from '@/components/ui/button'
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
// import { formatDateShort } from '@/lib/Leavemanagment-data'
// import type { LeaveRequest } from '@/types/Leavedashboard'

// interface PendingApprovalsCardProps {
//   requests: LeaveRequest[]
//   onViewDetails: (request: LeaveRequest) => void
// }

// export function PendingApprovalsCard({ requests, onViewDetails }: PendingApprovalsCardProps) {
//   return (
//     <Card className="h-full">
//       <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
//         <CardTitle className="text-base">Pending Approvals</CardTitle>
//         <Button variant="link" className="h-auto px-0 text-xs font-semibold">
//           View all
//           <ArrowRight className="size-3.5" />
//         </Button>
//       </CardHeader>
//       <CardContent className="space-y-2">
//         {requests.slice(0, 4).map((request) => (
//           <button
//             key={request.id}
//             type="button"
//             onClick={() => onViewDetails(request)}
//             className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-surface-muted"
//           >
//             <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
//               {request.employee.name
//                 .split(' ')
//                 .map((part) => part[0])
//                 .join('')}
//             </span>
//             <span className="min-w-0 flex-1">
//               <span className="block truncate text-sm font-semibold text-foreground">{request.employee.name}</span>
//               <span className="block truncate text-xs text-muted-foreground">{request.leaveType}</span>
//             </span>
//             <span className="shrink-0 text-right">
//               <span className="block text-xs font-semibold text-foreground">
//                 {formatDateShort(request.fromDate)}
//                 {request.fromDate !== request.toDate ? ` - ${formatDateShort(request.toDate)}` : ''}
//               </span>
//               <span className="block text-xs text-muted-foreground">{request.duration}</span>
//             </span>
//           </button>
//         ))}
//       </CardContent>
//     </Card>
//   )
// }

'use client'

import { ArrowRight, Check, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDateShort } from '@/lib/Leavemanagment-data'
import type { LeaveRequest } from '@/types/Leavedashboard'

interface PendingApprovalsCardProps {
  requests: LeaveRequest[]
  onViewDetails: (request: LeaveRequest) => void
} 

export function PendingApprovalsCard({
  requests,
  onViewDetails,
}: PendingApprovalsCardProps) {
  return (
    <Card className="h-full rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-semibold">
          Pending Approvals
        </CardTitle>

        <Button
          variant="link"
          className="h-auto p-0 text-sm font-semibold text-primary"
        >
          View all ({requests.length})
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {requests.slice(0, 4).map((request) => (
          <div
            key={request.id}
            className="flex items-center justify-between rounded-xl border border-border bg-background p-3 transition-all hover:bg-muted/30"
          >
            {/* Left Section */}
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11">
                <AvatarImage src={request.employee.avatar} />

                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {request.employee.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>

              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  {request.employee.name}
                </h4>

                <p className="text-xs text-muted-foreground">
                  {request.leaveType}
                </p>
              </div>
            </div>

            {/* Middle Section */}
            <div className="text-center">
              <p className="text-xs font-semibold text-foreground">
                {formatDateShort(request.fromDate)}
                {request.fromDate !== request.toDate &&
                  ` - ${formatDateShort(request.toDate)}`}
              </p>

              <p className="text-xs text-muted-foreground">
                {request.duration}
              </p>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-lg border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                onClick={() => console.log('Approve', request.id)}
              >
                <Check className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-lg border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => console.log('Reject', request.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}