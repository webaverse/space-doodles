import * as THREE from 'three'

import metaversefile from 'metaversefile'
const {
  useApp,
  useFrame,
  useLocalPlayer,
  useCameraManager,
  useLoaders,
  useInternals,
} = metaversefile
const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1')

export default () => {
  const app = useApp()
  const localPlayer = useLocalPlayer()

  {
    const particleCount = 200
    let info = {
      velocity: [particleCount],
    }

    //##################################################### get Dust geometry #####################################################
    const identityQuaternion = new THREE.Quaternion()
    const _getSmokeGeometry = (geometry) => {
      //console.log(geometry)
      const geometry2 = new THREE.BufferGeometry()
      ;['position', 'normal', 'uv'].forEach((k) => {
        geometry2.setAttribute(k, geometry.attributes[k])
      })
      geometry2.setIndex(geometry.index)

      const positions = new Float32Array(particleCount * 3)
      const positionsAttribute = new THREE.InstancedBufferAttribute(
        positions,
        3
      )
      geometry2.setAttribute('positions', positionsAttribute)
      const quaternions = new Float32Array(particleCount * 4)
      for (let i = 0; i < particleCount; i++) {
        identityQuaternion.toArray(quaternions, i * 4)
      }
      const quaternionsAttribute = new THREE.InstancedBufferAttribute(
        quaternions,
        4
      )
      geometry2.setAttribute('quaternions', quaternionsAttribute)

      const opacityAttribute = new THREE.InstancedBufferAttribute(
        new Float32Array(particleCount),
        1
      )
      opacityAttribute.setUsage(THREE.DynamicDrawUsage)
      geometry2.setAttribute('opacity', opacityAttribute)

      return geometry2
    }

    //##################################################### material #####################################################
    let dustMaterial = new THREE.MeshBasicMaterial({
      color: '#fff',
    })

    dustMaterial.transparent = true
    dustMaterial.depthWrite = false
    // dustMaterial.blending = THREE.SubtractiveBlending

    const uniforms = {
      uTime: {
        value: 0,
      },
    }
    dustMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime
      shader.vertexShader =
        'attribute float opacity;\n varying float vOpacity; varying vec3 vPos; \n ' +
        shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        [
          'vec3 transformed = vec3( position );',
          'vOpacity = opacity; vPos = position;',
        ].join('\n')
      )
      shader.fragmentShader =
        'uniform float uTime; varying float vOpacity; varying vec3 vPos;\n' +
        shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace(
        `vec4 diffuseColor = vec4( diffuse, opacity );`,
        `
              vec4 diffuseColor = vec4( diffuse, vOpacity);
  
            `
      )
    }

    //##################################################### load glb #####################################################
    let smokeApp
    ;(async () => {
      const u = `${baseUrl}/assets/smoke.glb`
      smokeApp = await new Promise((accept, reject) => {
        const { gltfLoader } = useLoaders()
        gltfLoader.load(u, accept, function onprogress() {}, reject)
      })
      smokeApp.scene.traverse((o) => {
        if (o.isMesh) {
          addInstancedMesh(o.geometry)
        }
      })
    })()

    //##################################################### object #####################################################
    let mesh = null
    let dummy = new THREE.Object3D()
    const group = new THREE.Group()

    function addInstancedMesh(dustGeometry) {
      const geometry = _getSmokeGeometry(dustGeometry)
      mesh = new THREE.InstancedMesh(geometry, dustMaterial, particleCount)
      group.add(mesh)
      app.add(group)
      setInstancedMeshPositions(mesh)
    }
    let matrix = new THREE.Matrix4()
    function setInstancedMeshPositions(mesh1) {
      for (let i = 0; i < mesh1.count; i++) {
        mesh.getMatrixAt(i, matrix)
        dummy.scale.x = 0.1
        dummy.scale.y = 0.1
        dummy.scale.z = 0.1
        dummy.position.x = 0
        dummy.position.y = 0
        dummy.position.z = Math.random() * 5
        dummy.rotation.x = Math.random() * i
        dummy.rotation.y = Math.random() * i
        dummy.rotation.z = Math.random() * i
        info.velocity[i] = new THREE.Vector3(0, 0, 1)
        info.velocity[i].divideScalar(20)
        dummy.updateMatrix()
        mesh1.setMatrixAt(i, dummy.matrix)
      }
      mesh1.instanceMatrix.needsUpdate = true
    }

    let dum = new THREE.Vector3()
    let originPoint = new THREE.Vector3(0, 0, 0)
    useFrame(({ timestamp }) => {
      group.position.copy(localPlayer.position)
      group.rotation.copy(localPlayer.rotation)
      if (localPlayer.avatar) {
        group.position.y -= localPlayer.avatar.height
        group.position.y += 0.23
      }
      localPlayer.getWorldDirection(dum)
      dum = dum.normalize()
      group.position.x += dum.x
      group.position.z += dum.z
      if (mesh) {
        const opacityAttribute = mesh.geometry.getAttribute('opacity')
        for (let i = 0; i < particleCount; i++) {
          mesh.getMatrixAt(i, matrix)
          matrix.decompose(dummy.position, dummy.quaternion, dummy.scale)

          if (dummy.position.distanceTo(originPoint) > 4) {
            opacityAttribute.setX(i, 0.05)
            dummy.position.x = 0
            dummy.position.y = 0
            dummy.position.z = 0
            dummy.scale.x = 0.1
            dummy.scale.y = 0.1
            dummy.scale.z = 0.1
            info.velocity[i].x = 0
            info.velocity[i].y = 0
            info.velocity[i].z = 0.7 + Math.random()

            info.velocity[i].divideScalar(20)
          }
          //opacityAttribute.setX(i, opacityAttribute.getX(i)-0.02);
          if (dummy.position.distanceTo(originPoint) > 2) {
            opacityAttribute.setX(i, opacityAttribute.getX(i) - 0.04)
            dummy.scale.x /= 1.017 + Math.random() / 150
            dummy.scale.y /= 1.017 + Math.random() / 150
            dummy.scale.z /= 1.017 + Math.random() / 150
          } else {
            dummy.scale.x *= 1.017 + Math.random() / 150
            dummy.scale.y *= 1.017 + Math.random() / 150
            dummy.scale.z *= 1.017 + Math.random() / 150
          }

          // dummy.rotation.x+=0.1*(Math.random()-0.5);
          // dummy.rotation.y+=0.1*(Math.random()-0.5);
          // dummy.rotation.z+=0.1*(Math.random()-0.5);

          dummy.position.add(info.velocity[i])
          dummy.updateMatrix()
          mesh.setMatrixAt(i, dummy.matrix)
        }
        mesh.instanceMatrix.needsUpdate = true
        opacityAttribute.needsUpdate = true
      }
      group.updateMatrixWorld()
    })
  }

  app.setComponent('renderPriority', 'low')

  return app
}
