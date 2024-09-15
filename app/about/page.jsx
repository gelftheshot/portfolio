"use client";
import Brain from "@/components/brain";
import { motion, useInView, useScroll } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";

const AboutPage = () => {
  const containerRef = useRef();

  const { scrollYProgress } = useScroll({ container: containerRef });

  const skillRef = useRef();
  // const isSkillRefInView = useInView(skillRef, {once:true});
  const isSkillRefInView = useInView(skillRef, { margin: "-100px" });

  const experienceRef = useRef();
  const isExperienceRefInView = useInView(experienceRef, { margin: "-100px" });

  return (
    <motion.div
      className="h-full"
      initial={{ y: "-200vh" }}
      animate={{ y: "0%" }}
      transition={{ duration: 1 }}
    >
      {/* CONTAINER */}
      <div className="h-full overflow-scroll lg:flex" ref={containerRef}>
        {/* TEXT CONTAINER */}
        <div className="p-4 sm:p-8 md:p-12 lg:p-20 xl:p-48 flex flex-col gap-24 md:gap-32 lg:gap-48 xl:gap-64 lg:w-2/3 lg:pr-0 xl:w-1/2">
          {/* BIOGRAPHY CONTAINER */}
          <div className="flex flex-col gap-12 justify-center">
            {/* BIOGRAPHY IMAGE */}
            <Image
              src="/Lihongebre.jpeg"
              alt="Lihon Gebre"
              width={224}
              height={224}
              className="w-56 h-56 rounded object-cover" style={{ objectPosition: '0% 10%' }}
            />
            {/* BIOGRAPHY TITLE */}
            <h1 className="font-bold text-2xl">BIOGRAPHY</h1>
            {/* BIOGRAPHY DESC */}
            <p className="text-lg">
              I&apos;m Lihon Gebre, a versatile tech professional with expertise in 
              Software Engineering, AI Development, and DevOps. My passion lies 
              in creating innovative solutions that bridge the gap between 
              cutting-edge technology and real-world applications.
            </p>
            {/* BIOGRAPHY QUOTE */}
            <span className="italic">
              Innovating at the intersection of code, AI, and infrastructure.
            </span>
            <motion.svg
              initial={{ opacity: 0.2, y: 0, rotate: 0 }}
              animate={{ opacity: 1, y: "10px", rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              width={50}
              height={50}
            >
              <path
                d="M5 15C5 16.8565 5.73754 18.6371 7.05029 19.9498C8.36305 21.2626 10.1435 21.9999 12 21.9999C13.8565 21.9999 15.637 21.2626 16.9498 19.9498C18.2625 18.6371 19 16.8565 19 15V9C19 7.14348 18.2625 5.36305 16.9498 4.05029C15.637 2.73754 13.8565 2 12 2C10.1435 2 8.36305 2.73754 7.05029 4.05029C5.73754 5.36305 5 7.14348 5 9V15Z"
                stroke="#000000"
                strokeWidth="1"
              ></path>
              <path d="M12 6V14" stroke="#000000" strokeWidth="1"></path>
              <path
                d="M15 11L12 14L9 11"
                stroke="#000000"
                strokeWidth="1"
              ></path>
            </motion.svg>
          </div>
          {/* SKILLS CONTAINER */}
          <div className="flex flex-col gap-12 justify-center" ref={skillRef}>
            {/* SKILL TITLE */}
            <motion.h1
              initial={{ x: "-300px" }}
              animate={isSkillRefInView ? { x: 0 } : {}}
              transition={{ delay: 0.2 }}
              className="font-bold text-2xl"
            >
              SKILLS
            </motion.h1>
            {/* SKILL LIST */}
            <motion.div
              initial={{ x: "-300px" }}
              animate={isSkillRefInView ? { x: 0 } : {}}
              className="flex flex-col gap-6"
            >
              {/* Programming Languages */}
              <div>
                <h3 className="font-semibold mb-2">Programming Languages</h3>
                <div className="flex gap-2 flex-wrap">
                  {["Python", "JavaScript", "C", "TypeScript", "Bash"].map((skill) => (
                    <div key={skill} className="rounded p-2 text-sm cursor-pointer bg-black text-white hover:bg-white hover:text-black">
                      {skill}
                    </div>
                  ))}
                </div>
              </div>

              {/* Frameworks */}
              <div>
                <h3 className="font-semibold mb-2">Frameworks</h3>
                <div className="flex gap-2 flex-wrap">
                  {["Django", "Flask", "Node.js", "Express", "Next.js", "React"].map((skill) => (
                    <div key={skill} className="rounded p-2 text-sm cursor-pointer bg-black text-white hover:bg-white hover:text-black">
                      {skill}
                    </div>
                  ))}
                </div>
              </div>

              {/* Databases */}
              <div>
                <h3 className="font-semibold mb-2">Databases</h3>
                <div className="flex gap-2 flex-wrap">
                  {["MySQL", "SQLite", "PostgreSQL", "MongoDB", "Firebase"].map((skill) => (
                    <div key={skill} className="rounded p-2 text-sm cursor-pointer bg-black text-white hover:bg-white hover:text-black">
                      {skill}
                    </div>
                  ))}
                </div>
              </div>

              {/* DevOps & Cloud */}
              <div>
                <h3 className="font-semibold mb-2">DevOps & Cloud</h3>
                <div className="flex gap-2 flex-wrap">
                  {["AWS", "Nginx", "Docker", "Kubernetes", "CI/CD"].map((skill) => (
                    <div key={skill} className="rounded p-2 text-sm cursor-pointer bg-black text-white hover:bg-white hover:text-black">
                      {skill}
                    </div>
                  ))}
                </div>
              </div>

              {/* AI & Machine Learning */}
              <div>
                <h3 className="font-semibold mb-2">AI & Machine Learning</h3>
                <div className="flex gap-2 flex-wrap">
                  {["LangChain", "Vector Databases", "Pinecone", "LangGraph", "Agents", "RAG", "TensorFlow", "PyTorch"].map((skill) => (
                    <div key={skill} className="rounded p-2 text-sm cursor-pointer bg-black text-white hover:bg-white hover:text-black">
                      {skill}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* SKILL SCROLL SVG */}
            <motion.svg
              initial={{ opacity: 0.2, y: 0, rotate: 0 }}
              animate={{ opacity: 1, y: "10px", rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              width={50}
              height={50}
            >
              {/* Gear-like path */}
              <path
                d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
                stroke="#000000"
                strokeWidth="1"
              />
              <path
                d="M19.4 15C19.7 14.1 19.8 13.1 19.8 12C19.8 10.9 19.7 9.9 19.4 9L21.5 7.3C21.7 7.1 21.8 6.9 21.7 6.7L19.7 3.3C19.6 3.1 19.4 3 19.2 3L16.6 3.6C15.9 3 15.1 2.5 14.2 2.1L13.5 0H10.5L9.8 2.1C8.9 2.5 8.1 3 7.4 3.6L4.8 3C4.6 3 4.4 3.1 4.3 3.3L2.3 6.7C2.2 6.9 2.3 7.1 2.5 7.3L4.6 9C4.3 9.9 4.2 10.9 4.2 12C4.2 13.1 4.3 14.1 4.6 15L2.5 16.7C2.3 16.9 2.2 17.1 2.3 17.3L4.3 20.7C4.4 20.9 4.6 21 4.8 21L7.4 20.4C8.1 21 8.9 21.5 9.8 21.9L10.5 24H13.5L14.2 21.9C15.1 21.5 15.9 21 16.6 20.4L19.2 21C19.4 21 19.6 20.9 19.7 20.7L21.7 17.3C21.8 17.1 21.7 16.9 21.5 16.7L19.4 15Z"
                stroke="#000000"
                strokeWidth="1"
              />
            </motion.svg>
          </div>
          {/* EXPERIENCE CONTAINER */}
          <div
            className="flex flex-col gap-12 justify-center pb-48"
            ref={experienceRef}
          >
            {/* EXPERIENCE TITLE */}
            <motion.h1
              initial={{ x: "-300px" }}
              animate={isExperienceRefInView ? { x: "0" } : {}}
              transition={{ delay: 0.2 }}
              className="font-bold text-2xl"
            >
              EXPERIENCE
            </motion.h1>
            {/* EXPERIENCE LIST */}
            <motion.div
              initial={{ x: "-300px" }}
              animate={isExperienceRefInView ? { x: "0" } : {}}
              className="flex flex-col gap-36" // Increased gap between experiences
            >
              {/* TechInnovate Inc. */}
              <div className="flex justify-between h-48">
                <div className="w-1/3 ">
                  <div className="bg-white p-3 font-semibold rounded-b-lg rounded-s-lg">
                    Senior Software Engineer & AI Developer
                  </div>
                  <div className="p-3 text-sm italic">
                    Led development of AI-powered software solutions and implemented robust DevOps practices.
                  </div>
                  <div className="p-3 text-red-400 text-sm font-semibold">
                    2020 - Present
                  </div>
                  <div className="p-1 rounded bg-white text-sm font-semibold w-fit">
                    TechInnovate Inc.
                  </div>
                </div>
                <div className="w-1/6 flex justify-center">
                  {/* LINE */}
                  <div className="w-1 h-full bg-gray-600 rounded relative">
                    {/* LINE CIRCLE */}
                    <div className="absolute w-5 h-5 rounded-full ring-4 ring-red-400 bg-white -left-2"></div>
                  </div>
                </div>
                <div className="w-1/3 "></div>
              </div>

              {/* Axion Engineering */}
              <div className="flex justify-between h-48">
                <div className="w-1/3 "></div>
                <div className="w-1/6 flex justify-center">
                  {/* LINE */}
                  <div className="w-1 h-full bg-gray-600 rounded relative">
                    {/* LINE CIRCLE */}
                    <div className="absolute w-5 h-5 rounded-full ring-4 ring-red-400 bg-white -left-2"></div>
                  </div>
                </div>
                <div className="w-1/3 ">
                  <div className="bg-white p-3 font-semibold rounded-b-lg rounded-s-lg">
                    Full Stack Developer
                  </div>
                  <div className="p-3 text-sm italic">
                    Developed and maintained web applications using React, Node.js, and PostgreSQL. Implemented RESTful APIs and improved application performance.
                  </div>
                  <div className="p-3 text-red-400 text-sm font-semibold">
                    2019 - 2020
                  </div>
                  <div className="p-1 rounded bg-white text-sm font-semibold w-fit">
                    Axion Engineering
                  </div>
                </div>
              </div>

              {/* Headstarter AI Fellow */}
              <div className="flex justify-between h-48">
                <div className="w-1/3 ">
                  <div className="bg-white p-3 font-semibold rounded-b-lg rounded-s-lg">
                    AI Engineer Fellow
                  </div>
                  <div className="p-3 text-sm italic">
                    Participated in intensive AI and machine learning projects. Developed models for natural language processing and computer vision applications.
                  </div>
                  <div className="p-3 text-red-400 text-sm font-semibold">
                    2018 - 2019
                  </div>
                  <div className="p-1 rounded bg-white text-sm font-semibold w-fit">
                    Headstarter AI Fellowship
                  </div>
                </div>
                <div className="w-1/6 flex justify-center">
                  {/* LINE */}
                  <div className="w-1 h-full bg-gray-600 rounded relative">
                    {/* LINE CIRCLE */}
                    <div className="absolute w-5 h-5 rounded-full ring-4 ring-red-400 bg-white -left-2"></div>
                  </div>
                </div>
                <div className="w-1/3 "></div>
              </div>

              {/* ALX Africa */}
              <div className="flex justify-between h-48">
                <div className="w-1/3 "></div>
                <div className="w-1/6 flex justify-center">
                  {/* LINE */}
                  <div className="w-1 h-full bg-gray-600 rounded relative">
                    {/* LINE CIRCLE */}
                    <div className="absolute w-5 h-5 rounded-full ring-4 ring-red-400 bg-white -left-2"></div>
                  </div>
                </div>
                <div className="w-1/3 ">
                  <div className="bg-white p-3 font-semibold rounded-b-lg rounded-s-lg">
                    Backend Developer
                  </div>
                  <div className="p-3 text-sm italic">
                    Designed and implemented scalable backend systems using Python and Django. Collaborated on RESTful API development and database optimization.
                  </div>
                  <div className="p-3 text-red-400 text-sm font-semibold">
                    2017 - 2018
                  </div>
                  <div className="p-1 rounded bg-white text-sm font-semibold w-fit">
                    ALX Africa
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        {/* SVG CONTAINER */}
        <div className="hidden lg:block w-1/3 sticky top-0 z-30 xl:w-1/2">
          <Brain scrollYProgress={scrollYProgress} />
        </div>
      </div>
    </motion.div>
  );
};

export default AboutPage;
