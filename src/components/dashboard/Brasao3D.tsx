import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { useRef, Suspense } from 'react';
import * as THREE from 'three';

function BrasaoMesh() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useLoader(THREE.TextureLoader, '/lovable-uploads/6255fad1-9ccc-48ca-9f22-745ddeacbdf0.png');
  
  // Configure texture for better visibility
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.format = THREE.RGBAFormat;

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.2;
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;
    }
  });

  return (
    <group>
      {/* Main brasao plane */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial 
          map={texture} 
          transparent={true}
          side={THREE.DoubleSide}
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>
      
      {/* Glow effect behind */}
      <mesh position={[0, 0, -0.1]} scale={1.2}>
        <planeGeometry args={[4, 4]} />
        <meshBasicMaterial 
          color="#FFD700" 
          transparent={true} 
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Decorative elements */}
      <mesh position={[0, 0, 0.1]}>
        <ringGeometry args={[2.2, 2.4, 32]} />
        <meshStandardMaterial 
          color="#FFD700" 
          transparent={true} 
          opacity={0.8}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
    </group>
  );
}

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} />
      <directionalLight position={[-10, -10, -5]} intensity={0.5} />
      <pointLight position={[0, 0, 10]} intensity={0.8} color="#FFD700" />
    </>
  );
}

export function Brasao3D() {
  return (
    <div className="w-full h-64 relative">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <Lighting />
          <BrasaoMesh />
          <OrbitControls 
            enableZoom={true}
            enablePan={false}
            enableRotate={true}
            autoRotate={true}
            autoRotateSpeed={1}
            minDistance={5}
            maxDistance={15}
          />
        </Suspense>
      </Canvas>
      
      {/* Loading overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-xs text-muted-foreground opacity-50">
          Arraste para rotacionar • Scroll para zoom
        </div>
      </div>
    </div>
  );
}