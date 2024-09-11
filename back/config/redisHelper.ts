// redis helper
const redis = require('redis');
const genericPool = require('generic-pool');

// 创建Redis客户端工厂
const factory = {
    create: () => {
        return redis.createClient({
            host: '192.168.1.201',
            port: 26379,
            password: 'mg@hs#2024',
            db: 3
        });
    },
    destroy: (client) => {
        client.quit();
    }
};

// 创建连接池
const redisPool = genericPool.createPool(factory, {
    max: 10,  // 最大连接数
    min: 2    // 最小连接数
});

// 导出获取连接的方法
const acquire = () => redisPool.acquire();

// 导出释放连接的方法
const release = (client) => redisPool.release(client);

// 示例：获取数据的方法
export const getRedisData = async (key) => {
    const client = await acquire();
    return new Promise((resolve, reject) => {
        client.get(key, (err, data) => {
            release(client);  // 使用后释放连接
            if (err) {
                return reject(err);
            }
            resolve(data);
        });
    });
};

// 导出模块接口
export default {
    getRedisData,
    acquire,
    release
};