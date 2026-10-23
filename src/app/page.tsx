'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/register');
    }, 3000); // 3 seconds delay

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center bg-black">
      <Image
        src="/splash-bg.png"
        alt="Fun Republic Shop Spin Win Splash"
        fill
        priority
        className="object-cover object-center"
      />
    </main>
  );
}