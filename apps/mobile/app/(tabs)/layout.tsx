import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useRole } from "@novaconnect/data";
import { ActivityIndicator } from "react-native";

export default function TabsLayout() {
  const { data: role, isLoading } = useRole();

  if (isLoading) {
    return <ActivityIndicator size="large" color="#3b82f6" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} />;
  }

  const isTeacher = role === 'teacher';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#3b82f6",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} />,
        }}
      />
      {isTeacher ? (
        <Tabs.Screen
          name="attendance"
          options={{
            title: "Attendance",
            tabBarIcon: ({ color }) => <Ionicons name="checkmark-circle" size={24} color={color} />,
          }}
        />
      ) : (
        <Tabs.Screen
          name="grades"
          options={{
            title: "Grades",
            tabBarIcon: ({ color }) => <Ionicons name="school" size={24} color={color} />,
          }}
        />
      )}
      {isTeacher && (
        <Tabs.Screen
          name="payroll"
          options={{
            title: "Payroll",
            tabBarIcon: ({ color }) => <Ionicons name="cash-outline" size={24} color={color} />,
          }}
        />
      )}
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarIcon: ({ color }) => <Ionicons name="notifications" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
