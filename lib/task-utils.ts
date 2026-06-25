export const getStatusColor = (status: string) => {
  switch(status) {
    case 'completed': return 'bg-success/10 text-success border-success/20'
    case 'in_progress': return 'bg-primary/10 text-primary border-primary/20'
    case 'review': return 'bg-warning/10 text-warning border-warning/20'
    case 'blocked': return 'bg-danger/10 text-danger border-danger/20'
    default: return 'bg-muted text-muted-foreground border-border'
  }
}

export const getPriorityColor = (priority: string) => {
  switch(priority) {
    case 'urgent': return 'text-danger font-semibold'
    case 'high': return 'text-warning font-semibold'
    case 'medium': return 'text-primary'
    default: return 'text-muted-foreground'
  }
}
