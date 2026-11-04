export type UserManagementActionState = {
  status: "idle" | "error" | "success";
  message: string;
  temporaryPassword?: string;
};

export const initialUserManagementActionState: UserManagementActionState = {
  status: "idle",
  message: "",
};
