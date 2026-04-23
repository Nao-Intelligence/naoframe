import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";

export default async function Home() {
  const user = await getAdminUser();
  redirect(user ? "/admin" : "/login");
}
