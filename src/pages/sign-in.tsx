import type {
  GetServerSideProps,
  InferGetServerSidePropsType,
  NextPage,
} from "next";
import { useRouter } from "next/router";
import { unstable_getServerSession as getServerSession } from "next-auth";
import { signIn } from "next-auth/react";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { prisma } from "@/server/db/client";
import { FcGoogle } from "react-icons/fc";
import Navbar from "@/components/Layout/Navbar";
import Meta from "@/components/Shared/Meta";
import { authOptions } from "./api/auth/[...nextauth]";
import { trpc } from "@/utils/trpc"; // Adjust the import according to your trpc setup

const SignIn: NextPage<SignInPageProps> = ({ session, serId }) => {
  const router = useRouter();
  const error = router.query.error as string;
  const getRoleMutation = trpc.useMutation("register.getRole");

  useEffect(() => {
    if (error) {
      const errors: { [key: string]: string } = {
        Signin: "Try signing with a different account",
        OAuthSignin: "Try signing with a different account",
        OAuthCallback: "Try signing with a different account",
        OAuthCreateAccount: "Try signing with a different account",
        EmailCreateAccount: "Try signing with a different account",
        Callback: "Try signing with a different account",
        OAuthAccountNotLinked: "Email is connected with another provider",
        EmailSignin: "Check your email address",
        CredentialsSignin: "Sign in failed. The credentials are incorrect",
      };

      toast.error(errors[error] || "Unable to sign in", {
        position: "bottom-right",
      });
    }
  }, [error]);

  useEffect(() => {
    const checkUserRoleSelection = async () => {
      const userId = session?.user?.id; // Replace with actual user ID retrieval logic

      if (userId) {
        const response = await getRoleMutation.mutateAsync({
          data: JSON.stringify({ userId }),
        });

        console.log("Response of verifying the existence of role");
        if (response != null) {
          if (response.role === "planner") router.push("project");
          else router.push("/chat");
        } else {
          router.push("/role-selection");
        }
      }
    };

    checkUserRoleSelection();
  }, [router, getRoleMutation]);

  const handleSignIn = (provider: string) => {
    signIn(provider).catch((err) => {
      console.log(err);
      toast.error(`Unable to sign in with ${provider}`, {
        position: "bottom-right",
      });
    });
  };

  return (
    <>
      <Meta
        title="Log in | UrbanScholar"
        description="Log in"
        image="/favicon.png"
      />
      <div className="min-h-screen flex flex-col items-stretch">
        <Navbar />
        <div className="flex-grow flex flex-col justify-center items-center gap-3">
          <h1 className="text-3xl text-center font-semibold">
            Log in to UrbanScholar
          </h1>
          <p className="text-center w-[95vw] max-w-[375px] text-sm text-gray-500">
            Manage your account and converse with the Urban Planning Assistant.
          </p>
          <button
            onClick={() => handleSignIn("google")}
            className="w-[95vw] max-w-[375px] flex justify-center items-center relative border border-gray-200 hover:border-gray-400 transition h-11"
          >
            <span>Continue with Google</span>
            <FcGoogle className="absolute top-1/2 -translate-y-1/2 left-3 w-6 h-6" />
          </button>
        </div>
      </div>
    </>
  );
};

export default SignIn;

type SignInPageProps = InferGetServerSidePropsType<typeof getServerSideProps>;

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getServerSession(req, res, authOptions);

  if (session?.user) {
    const role = await prisma.user.findFirst({
      where: {
        id: session?.user?.id,
      },
      select: {
        role: true,
      },
    });

    console.log("New sign-in with Role:", role);
    if (role != null && role.role != null) {
      if (role.role === "planner") {
        return {
          redirect: {
            destination: "/project",
            permanent: false,
          },
          props: {},
        };
      } else {
        return {
          redirect: {
            destination: "/chat",
            permanent: false,
          },
          props: {},
        };
      }
    } else {
      return {
        redirect: {
          destination: "/role-selection",
          permanent: false,
        },
        props: {},
      };
    }
  }

  return {
    props: {
      session: session,
      userId: session?.user?.id,
    },
  };
};
