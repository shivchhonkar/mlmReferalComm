import { redirect } from "next/navigation";

export default function UsersIndexPage() {
  redirect("/dashboard/admin/users/admins");
}