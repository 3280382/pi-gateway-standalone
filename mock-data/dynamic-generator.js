
// 动态Mock数据生成器 - 自动生成
// 最后更新: 2026-03-26T16:40:45.190Z

const os = require('os');
const path = require('path');

module.exports = {
  // 获取用户特定的路径映射
  getPathMapping(requestedPath) {
    const userHome = os.homedir();
    const projectRoot = path.join(__dirname, '..', '..');
    
    const mappings = {
      '/root': userHome,
      '/home/user': userHome,
      '/root/pi-mono/packages/gateway': projectRoot,
      '/project': projectRoot,
      '/tmp': os.tmpdir(),
      '.': process.cwd(),
      '': process.cwd()
    };
    
    for (const [mockPath, realPath] of Object.entries(mappings)) {
      if (requestedPath === mockPath || requestedPath.startsWith(mockPath + '/')) {
        const relativePath = requestedPath.substring(mockPath.length);
        return path.join(realPath, relativePath);
      }
    }
    
    return requestedPath.startsWith('/') ? requestedPath : path.join(process.cwd(), requestedPath);
  },
  
  // 生成动态响应
  generateDynamicResponse(requestedPath) {
    const targetPath = this.getPathMapping(requestedPath);
    
    return {
      currentPath: targetPath,
      parentPath: path.dirname(targetPath),
      items: this.generateItems(targetPath),
      _dynamic: true,
      _generatedAt: new Date().toISOString(),
      _user: os.userInfo().username
    };
  },
  
  // 生成文件项
  generateItems(targetPath) {
    // 基础项目
    const items = [
      {
        name: 'src',
        path: path.join(targetPath, 'src'),
        isDirectory: true,
        size: 0,
        modified: new Date().toISOString()
      },
      {
        name: 'package.json',
        path: path.join(targetPath, 'package.json'),
        isDirectory: false,
        size: 2500,
        modified: new Date().toISOString(),
        extension: 'json'
      }
    ];
    
    // 根据路径类型添加更多项目
    if (targetPath === os.homedir()) {
      items.push(
        {
          name: 'Documents',
          path: path.join(targetPath, 'Documents'),
          isDirectory: true,
          size: 0,
          modified: new Date().toISOString()
        },
        {
          name: 'Downloads',
          path: path.join(targetPath, 'Downloads'),
          isDirectory: true,
          size: 0,
          modified: new Date().toISOString()
        }
      );
    }
    
    // 排序
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return items;
  }
};
