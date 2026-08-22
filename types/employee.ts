/**
 * The employee as the directory list and the detail drawer use it.
 *
 * Two kinds of field live here on purpose:
 *
 *   - display strings (`full_name`, `department_name`, `jobRole`, `status`)
 *     which the table renders directly, and
 *   - the real foreign keys (`department_id`, `jobrole_id`, `user_profile_id`)
 *     which the drawer needs in order to save anything.
 *
 * The ids used to be absent entirely, which is why the filters compared
 * department names as strings and why the drawer could not pre-select the
 * employee's own department in a picker.
 */
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
  /** Display form: 'Active' | 'Inactive'. See `status_code` for the stored value. */
  status: string;
  lastActivity: string;
  join_Date: string;
  profile_name: string;
  skills: any[]; // Array of skill objects

  /** The stored tbluser.status - 1 active, 0 suspended. */
  status_code: number;
  department_id: number | null;
  jobrole_id: number | null;
  user_profile_id: number | null;
  employee_no: string | null;
}
