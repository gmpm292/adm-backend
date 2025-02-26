export class CreateAppEventInput {
  userIds?: Array<string>;
  officeIds?: Array<string>;
  sucursalIds?: Array<string>;
  departmentIds?: Array<string>;
  teamIds?: Array<string>;
  roles?: Array<string>;

  tipo: string;
  titulo: string;
  message: string;
}
