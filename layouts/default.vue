<script setup lang="ts">
const showDialog = ref(false)
function toggleDialog() {
  showDialog.value = !showDialog.value
}
</script>

<template>
  <main class="relative px-10 py-20">
    <nav class="fixed inset-x-0 top-0 h-16 flex items-center justify-between px-2 opacity-25">
      <div />
      <div flex items-center gap-2>
        <DarkToggle />
        <ScDropdownMenu>
          <ScDropdownMenuTrigger>
            <ScAvatar h-8 w-8 cursor-pointer hover="filter brightness-80" rounded-full>
              <ScAvatarImage src="https://github.com/radix-vue.png" alt="@radix-vue" />
              <ScAvatarFallback>CN</ScAvatarFallback>
            </ScAvatar>
          </ScDropdownMenuTrigger>
          <ScDropdownMenuContent avoid-collisions :collision-padding="{ right: 20 }">
            <ScDropdownMenuItem><div i-material-symbols-settings mr-2 /> Settings</ScDropdownMenuItem>
            <ScDropdownMenuItem @click="toggleDialog()">
              <div i-material-symbols-login mr-2 />Login
            </ScDropdownMenuItem>
          </ScDropdownMenuContent>
        </ScDropdownMenu>
        <ScDialog v-model:open="showDialog">
          <!-- <ScDialogTrigger as-child>

          </ScDialogTrigger> -->
          <ScDialogContent class="sm:max-w-[425px]">
            <ScDialogHeader>
              <ScDialogTitle>Login</ScDialogTitle>
              <ScDialogDescription>
                Login to your Netease Music account
              </ScDialogDescription>
            </ScDialogHeader>

            <Login />
          </ScDialogContent>
        </ScDialog>
      </div>
    </nav>
    <slot />
  </main>
</template>
