轮播图图片说明
================

请在此目录下放置启动轮播图使用的图片文件。

支持的图片格式：
- JPG/JPEG
- PNG
- GIF

建议图片尺寸：
- 宽度: 1920px
- 高度: 1080px
- 宽高比: 16:9

示例文件名：
- slide1.jpg
- slide2.jpg
- slide3.jpg

配置方法：
在 configs/config.json 文件中的 "carousel" 部分配置图片路径：

{
  "carousel": {
    "images": [
      "assets/carousel/slide1.jpg",
      "assets/carousel/slide2.jpg",
      "assets/carousel/slide3.jpg"
    ],
    "switchTime": 3000,        // 每张图片切换时间（毫秒）
    "displayDuration": 15000   // 总显示时长（毫秒）
  }
}

注意：
- 如果 images 数组为空，将不显示轮播图
- switchTime: 控制每张图片停留的时间
- displayDuration: 控制轮播图总共显示多长时间后自动关闭
