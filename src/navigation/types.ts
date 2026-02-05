export type RootStackParamList = {
    Login: undefined;
    SignUp: undefined;
    VerifyEmail: { email: string };
    CreateGroup: undefined;
    GroupDetails: { groupId: string; groupName: string };
    PilgrimDashboard: { userId: string };
    ModeratorDashboard: { userId: string };
};
