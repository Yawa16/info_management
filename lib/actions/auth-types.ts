export type RegisterState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Partial<
    Record<"firstName" | "lastName" | "email" | "password", string>
  >;
};

export const initialRegisterState: RegisterState = {
  status: "idle",
  message: "",
};

export type LoginState = {
  status: "idle" | "error";
  message: string;
};

export const initialLoginState: LoginState = {
  status: "idle",
  message: "",
};

export type PasswordResetRequestState = {
  status: "idle" | "error" | "success";
  message: string;
};

export const initialPasswordResetRequestState: PasswordResetRequestState = {
  status: "idle",
  message: "",
};

export type PasswordUpdateState = {
  status: "idle" | "error";
  message: string;
};

export const initialPasswordUpdateState: PasswordUpdateState = {
  status: "idle",
  message: "",
};
