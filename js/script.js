var url = ""; //Change to your TeamToy url
var db;
function isNull(arg1)
{
 return !arg1 && arg1!==0 && typeof arg1!=="boolean"?true:false;
}
function checkLoginStatus()
{
	if(isNull(kget("op_uid")))
	{
		change_page('index');
	}
}
window.addEventListener('push', checkLoginStatus);

document.addEventListener("deviceready", onDeviceReady, false);   
function onDeviceReady() {
	document.addEventListener("backbutton", onBackKeyDown, false);    
}

function isModalOpen() {
	if($("#todo_details").attr('class') == "modal active")
	{
		return "#todo_details";
	}
	else if($("#add_todo").attr('class') == "modal active")
	{
		return "#add_todo";
	}
	return false;
}
function onBackKeyDown() {
	var Modal;
	Modal = isModalOpen();
	if(Modal != false)
	{
		$(Modal).removeClass('active');
	}
	else
	{
		showToast("再按一次退出！");
		document.removeEventListener("backbutton", onBackKeyDown, false);
		document.addEventListener("backbutton", exitApp, false);
		var intervalID = window.setInterval(function() {  
			window.clearInterval(intervalID);  
			document.removeEventListener("backbutton", exitApp, false);
			document.addEventListener("backbutton", onBackKeyDown, false);
		}, 2000);
	}
}
function exitApp(){  
	navigator.app.exitApp();  
}

function showToast(msg, duration) {
	if(document.getElementById("toast")) document.body.removeChild(document.getElementById("toast"));
    duration = isNaN(duration) ? 2000 : duration;    
    var m = document.createElement('div');
	m.setAttribute("id", "toast");
    m.innerHTML = msg;    
    m.style.cssText = "width:60%; min-width:150px; background:#000; opacity:0.5; height:40px; color:#fff; line-height:40px; text-align:center; border-radius:5px; position:fixed; top:70%; left:20%; z-index:999999; font-weight:bold;";    
    document.body.appendChild(m);    
    setTimeout(function() {    
        var d = 0.5;    
        m.style.webkitTransition = '-webkit-transform ' + d    
                + 's ease-in, opacity ' + d + 's ease-in';    
        m.style.opacity = '0';    
        setTimeout(function() {    
            document.body.removeChild(m)    
        }, d * 1000);    
    }, duration);    
}
function logout()
{
	logout_clean();
	change_page('index');
}
function isOnline()
{
	var netstate = navigator.connection.type;
	if (netstate == Connection.NONE) return false;
	return true;
}
function logout_clean()
{
	window.localStorage.clear();
	db.transaction( function( tx )
	{
		tx.executeSql("DROP TABLE TODO ");
	} , db_error);
}

function database_clean()
{
	tt_confirm( '你确定要清除缓存吗？' , function(evt)
	{
		db.transaction( function( tx )
		{
			tx.executeSql("DROP TABLE TODO ");
		}, db_error , function()
		{
			showToast('缓存清理完成！');
		} );
	});
}

function isToggled(eid)
{
	if($(eid).attr('class') == "toggle active")
	{
		return true;
	}
	else if($(eid).attr('class') == "toggle")
	{
		return false;
	}
}
function login()
{
	if(!isOnline())
	{
		showToast("请检查网络连接！");
		return false;
	}
	if(isToggled('#remember_password'))
	{
		kset("op_remeberpass",true);
	}
	else
	{
		kset("op_remeberpass",false);
	}
	
	if( $('#email').val() == '' )
	{
		showToast("邮箱不能为空！");
		return false;
	} 
	if( $('#password').val() == '' )
	{
		showToast("密码不能为空！");
		return false;
	}
	// 'http://' +  $('#domain').val() + '/?m=api&a=get_token'
	// http://tttwo.sinaapp.com/api/user/get_token/
	$.post( url + 'index.php?c=api&a=user_get_token' , {'email':$('#email').val() , 'password':$('#password').val()  } , function( data )
	{
		console.log( data );
		if( data.err_code != 0 )
		{
			showToast("用户名或密码错误！");
		}
		else
		{
			if( (parseInt(data.data.uid) < 1) || ( data.data.token.length < 4 ) )
			showToast("服务器繁忙，请重试！");
			kset( 'op_domain' , url );
			kset( 'op_email' , $('#email').val() );
			kset( 'op_password' , $('#password').val() );
			
			kset( 'op_uid' , data.data.uid );
			kset( 'op_token' , data.data.token );
			kset( 'op_uname' , data.data.uname );
			kset( 'op_level' , data.data.level );
			change_page( 'todo' );
		}
		
	}, 'json' );	
}

function change_page( page )
{
	location = page + '.html';
}

function todo_add()
{
	var text = $('#todo_text').val();
	if( text.length < 1 ) return showToast('TODO不能为空~');
	
	var is_public = 1;
	if( isToggled("#private_value") ) is_public = 0;
	if(!isOnline())
	{
		showToast("请检查网络连接！");
		return false;
	}
	get_data("SELECT * FROM TODO WHERE content = ? AND status != 3" , [ text ] , function( data )
	{
		console.log(data);
		
		if( data != false )
		{
			showToast('同样的TODO已存在了哦，先完成了再添加吧');
			return false;
		}
		else
		{
			// 先放入本地数据库
			db.transaction( function( tx )
			{
				tx.executeSql("INSERT OR REPLACE INTO TODO (  tid , content , is_star , is_public , is_delete , is_sync , sync_error , status  ) VALUES (  ? , ? , ? , ? , ? , ? , ? , ? )" , 
				[
					0 ,
					text ,
					0 ,
					is_public ,
					0,
					0,
					0,
					1 
				]
				
				);
			}, db_error , function()
			{
				get_data("SELECT last_insert_rowid() as ltid FROM TODO LIMIT 1" , [] , function( ltidinfo )
				{
					var ltid = ltidinfo[0].ltid;
					if( ltid > 0 )
					{	
						db.transaction( function( tx )
						{
							tx.executeSql("UPDATE TODO SET tid = ? WHERE id = ? " , [ -ltid , ltid ] ); 
								
						}, db_error , function()
						{
							$('#todo_text').val('');
							$('#add_todo').removeClass('active');
							show_local_todo();
							$.post( url + 'index.php?c=api&a=todo_add' , {'token' : kget('op_token') , 'text':text , 'is_public':is_public  } ,
							function( data )
							{
								console.log( data );
								if( data.err_code != 0 )
								{
									showToast('同步失败');
									return false;
								}
								else
								{
									if(  data.data.content != text )
									{
										showToast('同步失败');
										return false;
									}
									db.transaction( function( tx )
									{
										tx.executeSql("UPDATE TODO SET is_sync = 1 , tid = ? WHERE id = ? " , [ data.data.tid , ltid ] ); 	
									}, db_error );
									showToast('操作已同步至云端！');
									show_local_todo();
								}
							});	
						} );
					}
				} );
			} );
		}
	} );
	
	
}

function todo_remove( liid , callback  )
{
	tt_confirm( '你确定要把此TODO删除吗？' , function(evt)
	{
		if(!isOnline())
		{
			showToast("请检查网络连接！");
			return false;
		}
		var reg = /[0-9]+$/;
				
		tid = parseInt( reg.exec( liid ) );
		if( tid < 1 ) return false;
		db.transaction( function( tx )
		{
			tx.executeSql("UPDATE TODO SET is_delete = 1, is_sync = 0 WHERE tid = ? " , [tid]);
		} , db_error , function()
		{
			$('#'+liid).remove();
			$('#todo_details').removeClass('active');
			$.post( url + 'index.php?c=api&a=todo_remove' , 
			{
				'token' : kget('op_token') , 
				'tid': tid
			} , function( data )
			{
				console.log( data );
			 
				if( data.err_code != 0 )
				{
					showToast('同步失败！');
				}
				else
				{
					showToast('操作已同步至云端！');
					db.transaction( function( tx )
					{
						tx.executeSql("UPDATE TODO SET is_sync = 1 WHERE tid = ? " , [tid]);
					} , db_error );
				}
				
				if( typeof callback == 'function' ) callback();
				
			}  );
		
		
		});
	});
}

function todo_done( liid , callback  )
{
	tt_confirm( '你确定要把此TODO标记为已完成吗？' , function(evt)
	{
		if(!isOnline())
		{
			showToast("请检查网络连接！");
			return false;
		}
		var reg = /[0-9]+$/;
				
		tid = parseInt( reg.exec( liid ) );
		if( tid < 1 ) return false;
		db.transaction( function( tx )
		{
			tx.executeSql("UPDATE TODO SET status = 3 , is_sync = 0 WHERE tid = ? " , [tid]);
		} , db_error , function()
		{
			$('#todo_list_done').prepend($('#'+liid));
			$('#todo_details').removeClass('active');
			$.post( url + 'index.php?c=api&a=todo_done' , 
			{
				'token' : kget('op_token') , 
				'tid': tid
			} , function( data )
			{
				console.log( data );
			 
				if( data.err_code != 0 )
				{
					showToast('同步失败！');
				}
				else
				{
					showToast('操作已同步至云端！');
					db.transaction( function( tx )
					{
						tx.executeSql("UPDATE TODO SET is_sync = 1 WHERE tid = ? " , [tid]);
					} , db_error );
				}
				
				if( typeof callback == 'function' ) callback();
				
			}  );
		
		
		});
	});
}

function show_todo_detail( tid )
{
	get_data( "SELECT * FROM TODO WHERE tid = '" + tid + "' LIMIT 0,1", [] , function( data )
	{
		$('#tdetailcontainer').html( $.tmpl( "tdetail_tpl" , {'item':data[0]} ) );
		$('#todo_details').addClass('active');
	}  );
}
function show_local_todo()
{
	$("#todo_list_normal").empty();
	get_data( "SELECT * FROM TODO WHERE status != 3 AND is_star != 1 AND is_follow != 1" , [] , function( data )
	{
		// 渲染
		$("#todo_list_normal").html( $.tmpl("todo_list_normal_tpl" , {'items':data}) );
	}  );	
	
	$("#todo_list_done").empty();
	get_data( "SELECT * FROM TODO WHERE status = 3 AND is_follow != 1" , [] , function( data )
	{
		// 渲染
		$("#todo_list_done").html( $.tmpl("todo_list_done_tpl" , {'items':data}) );
	}  );
	
	
	$("#todo_list_star").empty();
	get_data( "SELECT * FROM TODO WHERE status != 3 AND is_star = 1" , [] , function( data )
	{
		// 渲染
		$("#todo_list_star").html( $.tmpl("todo_list_star_tpl" , {'items':data}) );
	}  );
}

function refresh_token( obj , callback )
{
	if( obj.err_code == 10001 )
	{
		$.post( url + 'index.php?c=api&a=user_get_token' , {'email':kget('op_email')  , 'password':kget('op_password')   } , function( data )
		{
			var data_obj = data;
			if( data_obj.err_code == 0 )
			{
				kset( 'op_uid' , data_obj.data.uid );
				kset( 'op_token' , data_obj.data.token );
				
				if( typeof callback == 'function' ) callback(data_obj);
			}
				
		});
		
		return true;
		
	}
	
	return false;
}

function load_todo(notice)
{
	$.post( url + 'index.php?c=api&a=todo_list' , {'token' : kget('op_token') , 'by': 'tid' , 'ord' : 'desc' , 'count':100  } , function( data )
	{
		var data_obj = data;
		console.log( data_obj );
     
		
		if( data_obj.err_code != 0 )
		{
			// 
			if(!refresh_token( data_obj , load_todo ))
				if( data_obj.err_code != 10007 )
					showToast('加载失败！');
				else
				{
					db.transaction( function( tx )
					{
						tx.executeSql("DELETE FROM TODO ");
						tx.executeSql("DELETE FROM sqlite_sequence WHERE name = 'TODO'");
					} , db_error , function()
					{
						showToast('还没有TODO呢，赶紧加一个吧');
					});
					
				}
					
			
		}
		else
		{
			
			db.transaction( function( tx )
			{
				tx.executeSql("DELETE FROM TODO ");
				tx.executeSql("DELETE FROM sqlite_sequence WHERE name = 'TODO'");
			} , db_error , function()
			{
				// 先放入本地数据库
				db.transaction( function( tx )
				{
					for( var i = 0 ; i < data_obj.data.length ; i++  )
					{
						tx.executeSql("INSERT OR REPLACE INTO TODO (  tid , content , is_star , is_public , is_delete , is_follow , is_sync  , sync_error , status , create_at  ) VALUES (  ? , ? , ? , ? , ? , ? , ? , ? , ? , ? )" , 
						[
							data_obj.data[i].tid ,
							data_obj.data[i].content ,
							data_obj.data[i].is_star ,
							data_obj.data[i].is_public ,
							0,
							data_obj.data[i].is_follow ,
							1,
							0,
							data_obj.data[i].status ,
							data_obj.data[i].timeline
						]
						
						);
					}
					
					
				}, db_error , function()
				{
					if( notice ) showToast('刷新成功！');
					show_local_todo( );
				} );
			
			
			});
			
		}
		
	}  );	
}

function database_init()
{
	db.transaction( function( tx )
	{
		// TODO 
		
		tx.executeSql("CREATE TABLE IF NOT EXISTS TODO ( id INTEGER PRIMARY KEY AUTOINCREMENT, tid INT unique , content TEXT , is_star INT default 0, is_public INT default 0, is_delete INT default 0, is_sync INT default 0, is_follow INT default 0, sync_error INT default 0 , status INT default 1 , create_at default (datetime('now','localtime')) , last_action_at default (datetime('now','localtime')))");
		
		// MEMBERS
		tx.executeSql("CREATE TABLE IF NOT EXISTS MEMBERS ( id INTEGER PRIMARY KEY AUTOINCREMENT, uid INT unique , name TEXT, email TEXT , avatar_small TEXT , level INT , mobile TEXT , tel TEXT , eid TEXT , weibo TEXT , desp TEXT  )");
		
		
	}, db_error );
}

function db_error(err) 
{
	//alert("Error processing SQL: "+err);
	console.log( err );
}

function get_data( sql , darray , fn )
{
	db.transaction( function( tx )
	{
		tx.executeSql( sql , darray , function( tx , results )
		{
			var rdata = Array();
			var len = results.rows.length;
			
			if( len == 0 && typeof fn == 'function' )
			{
				return  fn(false);
				
			} 
			
			for( var i = 0 ; i < len ; i++  )
			{
				rdata[i] = results.rows.item(i);
				//console.log(results.rows.item(i));
			}
			
			if( typeof fn == 'function' ) fn(rdata);
			
			
		}, db_error);
	}, db_error );
}

function kset( key , value )
{
	window.localStorage.setItem( key , value );
}

function kget( key  )
{
	return window.localStorage.getItem( key );
}

function kremove( key )
{
	window.localStorage.removeItem( key );
}

function tt_confirm( string , callback , title , button  )
{
	if( !on_app  )
	{
		if(confirm( string ))
		{
			if( typeof callback == 'function'  )
				callback();
		}
	}
	else
	{
		if( !title ) title = '系统消息';
		if( !button ) button = '确定,取消';
		return navigator.notification.confirm( string , mycallback , title , button );
		
		function mycallback( btn )
		{
			if( btn == 1 && typeof callback == 'function' )
				callback();
		}
	}
	
}