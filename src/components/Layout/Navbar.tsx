import Image from 'next/image'
import Link from "next/link";
import { useRouter } from "next/router";
import { signOut, useSession } from "next-auth/react";
import { FC, FormEvent, useState } from "react";
import { AiOutlinePlus } from "react-icons/ai";
import { BiSearch, BiUser } from "react-icons/bi";
import { IoLogOutOutline } from "react-icons/io5";

import ClickAwayListener from "../Shared/ClickAwayListener";

const Navbar: FC = () => {
  const router = useRouter();

  const { data: session, status } = useSession();

  const [isDropdownOpened, setIsDropdownOpened] = useState(false);

  const [inputValue, setInputValue] = useState(
    router.pathname === "/search" && typeof router.query.q === "string"
      ? (router.query.q as string)
      : ""
  );

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (inputValue.trim()) {
      router.push({ pathname: "/search", query: { q: inputValue.trim() } });
    }
  };

  return (
    <nav className="border-b sticky top-0 z-20 bg-white">
      <div className="flex justify-center mx-4">
        <div className="w-full max-w-[1150px] flex justify-between items-center h-[60px]">
          <Link href="/">
            <div className="flex items-end gap-1">
              <Image src="/logo.png" alt="Logo" width={30} height={30} />
              <span className="text-2xl leading-[1] font-bold">UrbanScholar</span>
            </div>
          </Link>
          <form
            onSubmit={handleFormSubmit}
            className="relative w-[360px] h-[46px] hidden md:block"
          >
            <input
              className="w-full h-full outline-none bg-gray-1 rounded-full pl-4 pr-14 border border-transparent focus:border-gray-400 transition"
              type="text"
              placeholder="try: California Housing regression analysis..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <div className="absolute h-8 w-[1px] right-12 top-1/2 -translate-y-1/2 bg-gray-300"></div>
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <BiSearch className="fill-gray-400 w-6 h-6" />
            </button>
          </form>
          <div className="flex items-center gap-3">
            {status === "unauthenticated" ? (
              <Link href="/sign-in">
                <div className="rounded h-9 px-6 bg-pink text-white flex items-center hover:brightness-105 transition">
                  Log In
                </div>
              </Link>
            ) : status === "authenticated" ? (
              <ClickAwayListener onClickAway={() => setIsDropdownOpened(false)}>
                {(ref) => (
                  <div ref={ref} className="relative">
                    <button
                      onClick={() => setIsDropdownOpened(!isDropdownOpened)}
                    >
                      <Image
                        width={36}
                        height={36}
                        className="rounded-full"
                        src={session.user?.image!}
                        alt="Avatar"
                      />
                    </button>
                    <div
                      className={`absolute shadow-[rgb(0_0_0_/_12%)_0px_4px_16px] bg-white top-[120%] right-0 py-2 flex flex-col items-stretch [&>*]:whitespace-nowrap rounded-md transition-all z-50 ${
                        isDropdownOpened
                          ? "opacity-100 visible"
                          : "opacity-0 invisible"
                      }`}
                    >
                      {/* @ts-ignore */}
                      <Link href={`/user/${session?.user?.id}`}>
                        <div className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 transition">
                          <BiUser className="fill-black w-6 h-6" />
                          <span>Profile</span>
                        </div>
                      </Link>
                      <button
                        onClick={() => signOut()}
                        className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 transition"
                      >
                        <IoLogOutOutline className="fill-black w-6 h-6" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </ClickAwayListener>
            ) : (
              <></>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
