export type UserManagementActionState = {
  status: "idle" | "error" | "success";
  message: string;
  temporaryPassword?: string;
  values?: {
    firstName: string;
    lastName: string;
    email: string;
  };
};

export const initialUserManagementActionState: UserManagementActionState = {
  status: "idle",
  message: "",
};
