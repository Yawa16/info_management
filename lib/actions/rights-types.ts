export type RightItem = {
  id: number;
  code: string;
  label: string;
};

export type RightsModule = {
  code: string;
  name: string;
  rights: RightItem[];
};

export type RightsDialogData = {
  userName: string;
  modules: RightsModule[];
  grantedRightIds: number[];
};

export type LoadRightsResult =
  | { status: "success"; data: RightsDialogData }
  | { status: "error"; message: string };

export type SaveRightsResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };
