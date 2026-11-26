/**
 * The CSV columns of a company's people import. Same columns as the former Contacts import, plus Role, and without the company column: the import of a
 * company's People tab puts every row on that company, so a file cannot name another one.
 */
export const PEOPLE_IMPORT_HEADER_MAP: Record<string, string> = {
  salutation: 'salutation', 'first name': 'firstName', 'last name': 'lastName',
  title: 'title', department: 'department', role: 'contactRole', email: 'email',
  'secondary email': 'secondaryEmail', 'second email': 'secondaryEmail', phone: 'phone', mobile: 'mobile',
  'home phone': 'homePhone', birthday: 'birthday', 'lead source': 'leadSource',
  'mailing street': 'mailingStreet', 'mailing city': 'mailingCity',
  'mailing state': 'mailingState', 'mailing postal code': 'mailingCode',
  'mailing country': 'mailingCountry', description: 'description',
  'assigned to (user id)': 'assignedTo', 'assigned to': 'assignedTo',
}

export const PEOPLE_IMPORT_TEMPLATE_HEADERS = [
  'Salutation', 'First Name', 'Last Name', 'Title', 'Department', 'Role', 'Email', 'Secondary Email',
  'Phone', 'Mobile', 'Home Phone', 'Birthday', 'Lead Source', 'Mailing Street', 'Mailing City',
  'Mailing State', 'Mailing Postal Code', 'Mailing Country', 'Description', 'Assigned To (user id)',
] as const
