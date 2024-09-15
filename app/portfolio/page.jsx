"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

const items = [
  {
    id: 1,
    color: "from-blue-100 to-purple-200",
    title: "Only Hers",
    desc: "A fully functional e-commerce website connecting vendors, social media influencers, and female shoppers. Only-Hers offers a curated product selection, influencer partnerships, and a seamless shopping experience.",
    images: [
      "/onlyhers1.png",
      "/onlyhers2.png",
      "/onlyhers3.png",
      "/onlyhers4.png",
      "/onlyhers5.png",
    ],
    link: "https://only-hers.com",
    tech: "Django, HTML/CSS, JavaScript, jQuery, AJAX",
  },
  {
    id: 2,
    color: "from-purple-100 to-pink-200",
    title: "Academic Advisor AI",
    desc: "A Next.js application designed to assist students in academic planning, finding professors, and getting career advice. Features include professor search, major advisor, and course planner, using Google Generative AI and Pinecone for personalized recommendations.",
    images: [
      "/academy1.png",
      "/academy2.png",
      "/academy3.png",
      "/academy4.png",
      "/academy5.png",
    ],
    link: "https://academic-advisor-ai.com",
    tech: "Next.js, Google Generative AI, Pinecone",
  },
  {
    id: 3,
    color: "from-pink-100 to-red-200",
    title: "Whisper",
    desc: "A real-time chat application built using the MERN stack (MongoDB, Express.js, React.js, Node.js). Whisper provides instant messaging capabilities with a modern and intuitive interface.",
    images: [
      "/whisper1.png",
      "/whisper2.png",
      "/whisper3.png",
      "/wisper4.png",
    ],
    link: "https://whisper-chat.com",
    tech: "MongoDB, Express.js, React.js, Node.js",
  },
];

const PortfolioItem = ({ item }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const nextImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % item.images.length);
  };

  const prevImage = () => {
    console.log('prevImage called');
    setCurrentImageIndex((prevIndex) => 
      prevIndex === 0 ? item.images.length - 1 : prevIndex - 1
    );
  };

  const toggleZoom = () => {
    setIsZoomed(!isZoomed);
  };

  return (
    <div className={`h-screen w-screen flex items-center justify-center bg-gradient-to-r ${item.color}`}>
      <div className="flex flex-col md:flex-row gap-8 text-gray-800 w-full max-w-7xl px-4">
        <div className="md:w-1/2">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6">
            {item.title}
          </h1>
          <p className="text-lg mb-6">{item.desc}</p>
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Technologies:</h2>
            <p className="text-lg">{item.tech}</p>
          </div>
          <Link href={item.link} className="inline-block">
            <button className="px-6 py-3 bg-gray-800 text-white font-semibold rounded-lg transition-colors duration-300 hover:bg-gray-700">
              See Project
            </button>
          </Link>
        </div>
        <div className="md:w-1/2">
          <div className={`relative w-full h-[40vh] md:h-[50vh] lg:h-[60vh] overflow-hidden rounded-lg shadow-xl ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}>
            <Image 
              src={item.images[currentImageIndex]} 
              alt="" 
              fill 
              className={`object-cover transition-transform duration-300 ${isZoomed ? 'scale-150' : 'hover:scale-105'}`}
              onClick={toggleZoom}
            />
            {!isZoomed && (
              <>
                <button
                  onClick={() => {
                    console.log('Left arrow clicked');
                    prevImage();
                  }}
                  className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-gray-800 bg-opacity-75 hover:bg-opacity-100 rounded-full p-3 transition-all duration-300 ease-in-out"
                >
                  <FaChevronLeft className="text-white text-2xl" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-gray-800 bg-opacity-75 hover:bg-opacity-100 rounded-full p-3 transition-all duration-300 ease-in-out"
                >
                  <FaChevronRight className="text-white text-2xl" />
                </button>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-50 rounded-full px-2 py-1">
                  <span className="text-black text-sm">
                    {currentImageIndex + 1} / {item.images.length}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PortfolioPage = () => {
  const ref = useRef();

  const { scrollYProgress } = useScroll({ target: ref });
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-80%"]);

  return (
    <motion.div
      className="h-full"
      initial={{ y: "-200vh" }}
      animate={{ y: "0%" }}
      transition={{ duration: 1 }}
    >
      <div className="h-[600vh] relative" ref={ref}>
        <div className="w-screen h-[calc(100vh-6rem)] flex items-center justify-center text-8xl text-center">
          My Works
        </div>
        <div className="sticky top-0 flex h-screen gap-4 items-center overflow-hidden">
          <motion.div style={{ x }} className="flex">
            <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-r from-purple-300 to-red-300" />
            {items.map((item) => (
              <PortfolioItem key={item.id} item={item} />
            ))}
          </motion.div>
        </div>
      </div>
      {/* Add padding to create space between portfolio items and the "Do you have a project?" section */}
      <div className="py-20">
        <div className="w-screen h-screen flex flex-col gap-16 items-center justify-center text-center">
          <h1 className="text-6xl md:text-8xl">Do you have a project?</h1>
          <div className="relative">
            <motion.svg
              animate={{ rotate: 360 }}
              transition={{ duration: 8, ease: "linear", repeat: Infinity }}
              viewBox="0 0 300 300"
              className="w-64 h-64 md:w-[500px] md:h-[500px] "
            >
              <defs>
                <path
                  id="circlePath"
                  d="M 150, 150 m -60, 0 a 60,60 0 0,1 120,0 a 60,60 0 0,1 -120,0 "
                />
              </defs>
              <text fill="#000">
                <textPath xlinkHref="#circlePath" className="text-xl">
                  Software Engineer, AI Developer, and DevOps Engineer
                </textPath>
              </text>
            </motion.svg>
            <Link
              href="/contact"
              className="w-16 h-16 md:w-28 md:h-28 absolute top-0 left-0 right-0 bottom-0 m-auto bg-black text-white rounded-full flex items-center justify-center"
            >
              Hire Me
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PortfolioPage;
