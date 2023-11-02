<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'

import { Button } from '@/components/shadcn/button'
import {
  FormControl,
  // FormDescription,
  FormField,
  FormItem,
  // FormLabel,
  FormMessage,
} from '@/components/shadcn/form'

const formSchema = toTypedSchema(z.object({
  phone: z.string().length(11, 'Phone number must be 11 digits'),
  password: z.string().min(6, 'Password must contain at least 6 characters').max(20, 'Password must contain at most 20 characters'),
}))

const { handleSubmit } = useForm({
  validationSchema: formSchema,
})

const errorMsg = ref('')
const onSubmit = handleSubmit(async (values) => {
  const { data, status, message } = await $fetch('/api/login', {
    method: 'POST',
    body: {
      ...values,
      // phone: values.phone,
      // md5_password: values.password,
      // countrycode: '86',
    },
  })
  if (!status) {
    errorMsg.value = message
    return
  }
  const { cookie } = data
  console.log('cookie', cookie)
})
</script>

<template>
  <form v-auto-animate class="space-y-6" @submit="onSubmit">
    <FormField v-slot="{ componentField }" name="phone">
      <FormItem v-auto-animate>
        <FormControl>
          <ScInput type="text" placeholder="phone" v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <FormField v-slot="{ componentField }" name="password">
      <FormItem v-auto-animate>
        <FormControl>
          <ScInput type="password" placeholder="password" v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <Button class="w-full" type="submit">
      Login
    </Button>
    <p v-if="errorMsg" text-destructive>
      {{ errorMsg }}
    </p>
  </form>
</template>
