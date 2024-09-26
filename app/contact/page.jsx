"use client";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import emailjs from "@emailjs/browser";

emailjs.init(process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY);

const ContactPage = () => {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const text = "Say Hello";

  const form = useRef();

  const sendEmail = (e) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    setSuccess(false);

    emailjs.sendForm(
      process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
      process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
      form.current,
      process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
    )
    .then(
      (result) => {
        console.log('Email sent successfully:', result.text);
        setSuccess(true);
        setLoading(false);
        form.current.reset();
      },
      (error) => {
        console.error('Failed to send email:', error);
        setError(true);
        setLoading(false);
      }
    )
    .catch((err) => {
      console.error('Unexpected error:', err);
      setError(true);
      setLoading(false);
    });
  };

  console.log('Service ID:', process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID);
  console.log('Template ID:', process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID);
  console.log('Public Key:', process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY);

  return (
    <motion.div
      className="h-full"
      initial={{ y: "-200vh" }}
      animate={{ y: "0%" }}
      transition={{ duration: 1 }}
    >
      <div className="h-full flex flex-col lg:flex-row px-4 sm:px-8 md:px-12 lg:px-20 xl:px-48">
        {/* TEXT CONTAINER */}
        <div className="h-1/2 lg:h-full lg:w-1/2 flex items-center justify-center text-4xl lg:text-6xl">
          <div>
            {text.split("").map((letter, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: index * 0.1,
                }}
              >
                {letter}
              </motion.span>
            ))}
            😊
          </div>
        </div>
        {/* FORM CONTAINER */}
        <form
          onSubmit={sendEmail}
          ref={form}
          className="h-1/2 lg:h-full lg:w-1/2 bg-red-50 rounded-xl text-xl flex flex-col gap-4 justify-center p-8 lg:p-24"
        >
          <input
            type="text"
            name="user_name"
            placeholder="Name"
            required
            className="bg-red-50 border-b-2 border-b-black outline-none w-full pb-1"
          />
          <input
            name="user_email"
            type="email"
            placeholder="Email"
            required
            className="bg-red-50 border-b-2 border-b-black outline-none w-full pb-1"
          />
          <textarea
            rows={6}
            name="message"
            placeholder="Message"
            required
            className="bg-red-50 border-b-2 border-b-black outline-none resize-none w-full pb-1"
          />
          <button
            className="bg-purple-200 rounded font-semibold text-gray-600 p-4"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send"}
          </button>
          {success && (
            <span className="text-green-600 font-semibold">
              Your message has been sent successfully!
            </span>
          )}
          {error && (
            <span className="text-red-600 font-semibold">
              Something went wrong. Please try again.
            </span>
          )}
        </form>
      </div>
    </motion.div>
  );
};

export default ContactPage;
