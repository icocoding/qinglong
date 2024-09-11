import intl from 'react-intl-universal';

export default {
    get: (key: string, variables?: Object) => {
        if (variables) {
          return intl.get(key, variables) || key;
        }
        return intl.get(key) || key;
    },
  };
  