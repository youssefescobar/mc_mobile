export type RootStackParamList = {
    Login: undefined;
    SignUp: undefined;
    VerifyEmail: { email: string; isPilgrim?: boolean; postVerifyAction?: 'request-moderator' };
    CreateGroup: undefined;
    GroupDetails: { groupId: string; groupName: string; focusPilgrimId?: string; openProfile?: boolean };
    PilgrimDashboard: { userId: string };
    PilgrimProfile: { userId: string };
    ModeratorDashboard: { userId: string };
    Notifications: undefined;
    EditProfile: undefined;
    PilgrimSignUp: undefined;
    PilgrimMessagesScreen: { groupId: string; groupName: string; userId?: string };
    ModeratorMessagesScreen: { groupId: string; groupName: string };
    JoinGroup: { userId: string };
    CommunicationScreen: { groupId: string };
};
