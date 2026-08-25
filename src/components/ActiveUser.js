'use client';
import { useSession } from "next-auth/react";

export default function Child({ sendData }) {

    


  return (
    <button
      onClick={() => sendData('Hello Parent 👋')}
    >
      Send Data to Parent
    </button>
  );
}
