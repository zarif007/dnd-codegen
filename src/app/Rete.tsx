"use client";

import "./rete.css";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRete } from "rete-react-render-plugin";
import { createEditor } from "../engine/editor";

export default function Rete() {
  const [ref, editor] = useRete(createEditor);
  const [modules, setModules] = useState<string[]>([]);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!editor || isInitialized.current) return;

    const initializeEditor = async () => {
      try {
        const list = editor.getModules();

        setTimeout(() => {
          setModules(list);
          if (list.length > 0) {
            editor.openModule(list[0]);
          }
        }, 0);

        isInitialized.current = true;
      } catch (error) {
        console.error("Error initializing editor:", error);
      }
    };

    initializeEditor();
  }, [editor]);

  return (
    <div className="App">
      <div
        ref={ref}
        style={{
          height: "100vh",
          width: "100vw",
        }}
      />
    </div>
  );
}
