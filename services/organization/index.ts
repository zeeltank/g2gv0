/**
 * Organization Service
 * API calls for organization management
 */

import { apiClient } from '@/services/core'

export interface Organization {
  id: string
  name: string
  code: string
  logo?: string
  settings: Record<string, unknown>
}

export interface Department {
  id: string
  name: string
  code: string
  parentId?: string
  managerId?: string
  employeeCount: number
}

export interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  departmentId: string
  role: string
  status: 'active' | 'inactive' | 'terminated'
}

export const organizationService = {
  // Organizations
  getOrganizations: () => apiClient.get<Organization[]>('/organizations'),
  getOrganization: (id: string) => apiClient.get<Organization>(`/organizations/${id}`),
  createOrganization: (data: Partial<Organization>) => apiClient.post<Organization>('/organizations', data),
  updateOrganization: (id: string, data: Partial<Organization>) => 
    apiClient.patch<Organization>(`/organizations/${id}`, data),

  // Departments
  getDepartments: (orgId?: string) => 
    apiClient.get<Department[]>('/departments', orgId ? { organizationId: orgId } : undefined),
  getDepartment: (id: string) => apiClient.get<Department>(`/departments/${id}`),
  createDepartment: (data: Partial<Department>) => apiClient.post<Department>('/departments', data),
  updateDepartment: (id: string, data: Partial<Department>) => 
    apiClient.patch<Department>(`/departments/${id}`, data),
  deleteDepartment: (id: string) => apiClient.delete<void>(`/departments/${id}`),

  // Employees
  getEmployees: (params?: { departmentId?: string; status?: string }) => 
    apiClient.get<Employee[]>('/employees', params as Record<string, string>),
  getEmployee: (id: string) => apiClient.get<Employee>(`/employees/${id}`),
  createEmployee: (data: Partial<Employee>) => apiClient.post<Employee>('/employees', data),
  updateEmployee: (id: string, data: Partial<Employee>) => 
    apiClient.patch<Employee>(`/employees/${id}`, data),
  terminateEmployee: (id: string) => apiClient.post<void>(`/employees/${id}/terminate`, {}),
}
