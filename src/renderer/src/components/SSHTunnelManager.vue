<template>
  <div class="ssh-tunnel-manager">
    <el-dialog
      :model-value="visible"
      title="SSH 隧道管理"
      width="600px"
      @update:model-value="$emit('update:visible', $event)"
      :modal="true"
      :close-on-click-modal="false"
      append-to-body
    >
      <div class="tunnel-content">
        <!-- 添加隧道的表单 -->
        <el-form :model="newTunnel" :rules="rules" ref="formRef" label-width="120px" class="tunnel-form">
          <el-form-item label="本地端口" prop="localPort">
            <el-input-number v-model="newTunnel.localPort" :min="1" :max="65535" controls-position="right" />
          </el-form-item>
          <el-form-item label="目标主机" prop="remoteHost">
            <el-input v-model="newTunnel.remoteHost" placeholder="例如: 127.0.0.1" />
          </el-form-item>
          <el-form-item label="目标端口" prop="remotePort">
            <el-input-number v-model="newTunnel.remotePort" :min="1" :max="65535" controls-position="right" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="addTunnel" :loading="isAdding">添加隧道</el-button>
          </el-form-item>
        </el-form>

        <!-- 活动隧道列表 -->
        <el-divider>活动隧道</el-divider>
        <div class="active-tunnels-list">
          <el-table :data="activeTunnels" style="width: 100%" empty-text="暂无活动隧道">
            <el-table-column prop="localPort" label="本地端口" width="120" />
            <el-table-column label="转发至">
              <template #default="{ row }">
                {{ row.remoteHost }}:{{ row.remotePort }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
               <template #default>
                <el-tag type="success" size="small">运行中</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button type="danger" size="small" @click="stopTunnel(row.id)" :loading="isStopping[row.id]">停止</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  connectionId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:visible'])

const formRef = ref(null)
const newTunnel = reactive({
  localPort: 8080,
  remoteHost: '127.0.0.1',
  remotePort: 80
})

const rules = {
  localPort: [{ required: true, message: '本地端口不能为空', trigger: 'blur' }],
  remoteHost: [{ required: true, message: '目标主机不能为空', trigger: 'blur' }],
  remotePort: [{ required: true, message: '目标端口不能为空', trigger: 'blur' }]
}

const activeTunnels = ref([])
const isAdding = ref(false)
const isStopping = reactive({})

const addTunnel = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (valid) {
      isAdding.value = true
      try {
        const result = await window.ssh.startTunnel(props.connectionId, { ...newTunnel })
        if (result.success) {
          activeTunnels.value.push({
            id: result.tunnelId,
            ...newTunnel
          })
          ElMessage.success(`隧道已在本地端口 ${newTunnel.localPort} 上启动`)
        } else {
          ElMessage.error(`启动隧道失败: ${result.error}`)
        }
      } catch (error) {
        ElMessage.error(`启动隧道时出错: ${error.message}`)
      } finally {
        isAdding.value = false
      }
    }
  })
}

const stopTunnel = async (tunnelId) => {
  isStopping[tunnelId] = true
  try {
    const result = await window.ssh.stopTunnel(tunnelId)
    if (result.success) {
      activeTunnels.value = activeTunnels.value.filter(t => t.id !== tunnelId)
      ElMessage.success('隧道已停止')
    } else {
      ElMessage.error(`停止隧道失败: ${result.error}`)
    }
  } catch (error) {
    ElMessage.error(`停止隧道时出错: ${error.message}`)
  } finally {
    isStopping[tunnelId] = false
  }
}

// 监听从主进程来的隧道事件
const handleTunnelStarted = (tunnelId, tunnelConfig) => {
  // 确保此事件是针对当前连接的
  if (tunnelId.includes(props.connectionId)) {
    const exists = activeTunnels.value.some(t => t.id === tunnelId)
    if (!exists) {
       activeTunnels.value.push({ id: tunnelId, ...tunnelConfig })
    }
  }
}

onMounted(() => {
  window.ipcRenderer.on('ssh:tunnel-started', handleTunnelStarted)
})

onUnmounted(() => {
  window.ipcRenderer.removeListener('ssh:tunnel-started', handleTunnelStarted)
})

</script>

<style scoped>
.ssh-tunnel-manager {
  /* 可以根据需要添加样式 */
}
.tunnel-content {
  padding: 0 20px;
}
.tunnel-form {
  margin-bottom: 20px;
}
.active-tunnels-list {
  max-height: 300px;
  overflow-y: auto;
}
</style> 