"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link  from 'next/link'
const Homepage = () => {
  return (
    <motion.div
      className="h-full"
      initial={{ y: "-200vh" }}
      animate={{ y: "0%" }}
      transition={{ duration: 1 }}
    >
      <div className="h-full flex flex-col lg:flex-row px-4 sm:px-8 md:px-12 lg:px-20 xl:px-48">
        {/* IMAGE CONTAINER */}
        <div className="h-1/2 lg:h-full lg:w-1/2 relative">
          <Image src="/hero.jpeg" alt="" fill className="object-contain" />
        </div>
        {/* TEXT CONTAINER */}
        <div className="h-1/2 lg:h-full lg:w-1/2 flex flex-col gap-8 items-center justify-center">
          <h1 className="text-4xl md:text-6xl font-bold">
            Innovating with Code, AI, and DevOps.
          </h1>
          <p className="md:text-xl">
            Welcome to my digital portfolio. I&apos;m <span style={{ color: 'blue' }}>Lihon Gebre</span>, a Software Engineer, 
            AI Developer, and DevOps Engineer. My work combines cutting-edge 
            technology with practical solutions, showcasing a commitment to 
            excellence across multiple domains of modern computing.
          </p>
          <div className="w-full flex gap-4">
            <Link href="/portfolio" legacyBehavior>
              <a className="p-4 rounded-lg ring-1 ring-black bg-black text-white">
                View My Work
              </a>
            </Link>
            <Link href="/contact" legacyBehavior>
              <a className="p-4 rounded-lg ring-1 ring-black bg-black text-white">
                Contact Me
              </a>
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Homepage;
