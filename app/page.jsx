"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link from 'next/link';

const Homepage = () => {
  return (
    <motion.main
      className="min-h-screen bg-gradient-to-b from-blue-100 to-red-100"
      initial={{ y: "-200vh" }}
      animate={{ y: "0%" }}
      transition={{ duration: 1 }}
    >
      <div className="min-h-screen flex flex-col px-4 sm:px-8 md:px-12 lg:px-20 xl:px-48">
        {/* IMAGE CONTAINER */}
        <div className="mt-4 mb-8 lg:hidden">
          <Image 
            src="/hero.jpeg" 
            alt="Hero image"
            width={100}
            height={100}
            className="w-24 h-24 rounded-full object-cover"
            priority
          />
        </div>
        <div className="flex-grow flex flex-col lg:flex-row">
          {/* LARGE SCREEN IMAGE */}
          <div className="hidden lg:block lg:w-1/2 relative">
            <Image 
              src="/hero.jpeg" 
              alt="Hero image"
              fill
              className="object-cover"
              priority
            />
          </div>
          {/* TEXT CONTAINER */}
          <div className="lg:w-1/2 flex flex-col gap-8 items-center justify-center">
            <h1 className="text-4xl md:text-6xl font-bold text-center lg:text-left">
              Innovating with Code, AI, and DevOps.
            </h1>
            <p className="md:text-xl text-center lg:text-left">
              Welcome to my digital portfolio. I&apos;m <span style={{ color: 'blue' }}>Lihon Gebre</span>, a Software Engineer, 
              AI Developer, and DevOps Engineer. My work combines cutting-edge 
              technology with practical solutions, showcasing a commitment to 
              excellence across multiple domains of modern computing.
            </p>
            <div className="w-full flex flex-col sm:flex-row gap-4">
              <Link href="/portfolio" className="p-4 rounded-lg ring-1 ring-black bg-black text-white text-center">
                View My Work
              </Link>
              <Link href="/contact" className="p-4 rounded-lg ring-1 ring-black text-center">
                Contact Me
              </Link>
              <Link href="/askai" className="p-4 rounded-lg ring-1 ring-black text-center bg-blue-500 text-white hover:bg-blue-600 transition-colors relative overflow-hidden group flex items-center justify-center">
                <span className="mr-2">Ask my AI</span>
                <motion.span
                  className="inline-block"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  🤖
                </motion.span>
                <span className="ml-2">about me</span>
                <motion.div 
                  className="absolute inset-0 bg-blue-600"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.main>
  );
};

export default Homepage;
