export type ApprovalState = {
  status: "idle" | "error" | "success";
  message: string;
};

export const initialApprovalState: ApprovalState = {
  status: "idle",
  message: "",
};

export type CreateUserState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Partial<
    Record<"firstName" | "lastName" | "email" | "temporaryPassword", string>
  >;
};

export const initialCreateUserState: CreateUserState = {
  status: "idle",
  message: "",
};
