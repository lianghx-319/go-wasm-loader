import {createReadStream, createWriteStream} from 'fs'

export function copyFile(src: string, dest: string) {
  createReadStream(src).pipe(createWriteStream(dest))
} 